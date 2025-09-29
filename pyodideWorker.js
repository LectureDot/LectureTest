/*TODO:
  in unitTest, need a way to convert all await input to input (or vice versa)
  need a way to kill prior python process (interrupt)
  must remove outputContainer from default, and make it an arg in .run
  when pyIDE.addAwaitToEveryInput is true \broken lines are combined into single lines,
    which messes with error trace line numbers
  if window has multiple IDEs, package installer will only work for last added IDE
    unless it is the case that package installation works for all IDEs on a page (need to check)
  add ANSI color
  need to figure out how to neatly handle sys.stdin.read(...) in run();
    it's already handled in unitTest()
*/

(async function(){
  let pyodideLoaded, kernelReady, inputPromiseResolve={};
  const interruptBuffer = new Int8Array(1);
  interruptBuffer[0] = 0;

  try{
    // import loadPyodide() function
    importScripts("https://cdn.jsdelivr.net/pyodide/v0.28.2/full/pyodide.js");
  }catch(err){
    console.error("Failed to import pyodide:", err);
    // notify the main thread that the worker is unusable
    self.postMessage({ 
      error: "Worker initialization failed: Could not import Pyodide.",
      details: err.message 
    });
    // stop further execution in the worker since Pyodide isn't available
    return; 
  }
  // load pyodide kernel
  async function loadPyodidePromise() {
    self.pythonKernel = await loadPyodide();
    self.pythonKernel.setInterruptBuffer(interruptBuffer);
    self.postMessage({init:true});
  }
  pyodideLoaded = loadPyodidePromise();


  // Listener for messages from the main thread
  self.onmessage = async event=>{
    await pyodideLoaded;
    const pyId = event.data.pyId;
    if(!pyId){
      console.error('No process ID specified.');
      return;
    }
    // console.log('msg from main',JSON.stringify(event.data));
    if(event.data.type==='RUN'){
      if(kernelReady)await kernelReady;
      self.postMessage({ pyId, ready:true });
      kernelReady = run(pyId, event.data.code, event.data.options);
      await kernelReady;
      self.postMessage({ pyId, done:true });
    }else if(event.data.type==='UNITTEST'){
      if(kernelReady)await kernelReady;
      kernelReady = unitTest(event.data.code, event.data.testInput, event.data.testCode, event.data.maxOutput);
      const output = await kernelReady;
      self.postMessage({ pyId, output, done:true });
    }else if(event.data.type==='INPUT' && inputPromiseResolve){
      inputPromiseResolve[pyId](event.data.text);
      delete inputPromiseResolve[pyId];
    // }else if(event.data.type==='INTERRUPT'){
    //   interruptBuffer[0] = 2;
    //   self.postMessage({ pyId, output:'🛑 Code interrupted during execution.\n', done:true });
    // }else if(event.data.type==='INSTALL'){
    //   if(event.data.package){
    //     await installPackage(event.data.package);
    //   }else{
    //     await promptToInstallPackages();
    //   }
    }
  };


  // clear pyodide global namespace
  function clearGlobalNamespace(){
    interruptBuffer[0] = 0;
    self.pythonKernel.runPython(`
      globals_to_keep = {'__name__', '__doc__', '__package__', '__loader__', '__spec__', '__annotations__', '__builtins__', '_pyodide_core'}
      user_globals = [name for name in globals() if name not in globals_to_keep]
      for name in user_globals:
          del globals()[name]
      del name
      del user_globals
    `);
  }

  function postOutput(pyId, output, type){
    // if(type!=='input')output+='\n';
    self.postMessage({ pyId, output, type });
  }
  function postChars(pyId,chars,type){
    const output = String.fromCharCode.apply(null, chars);
    postOutput(pyId, output, type);
    return output.length;
  }
  function postError(pyId, msg){
    postOutput(pyId, msg+'\n', 'error');
  }
  function postWarning(pyId, msg){
    postOutput(pyId, msg+'\n', 'warning');
  }

  function getInput(pyId, prompt){
    postOutput(pyId, prompt, 'input');
    return new Promise((resolve)=>{
      inputPromiseResolve[pyId] = resolve;
    });
  }


  // clean up error to remove pyodide from traceback
  function pythonError(err){
    err = err.toString();
    const lines = err.split('\n');
    const errMsg = [lines[0]];
    let inTraceback = false;
    for(let line of lines.slice(1)){
      if(line.trimLeft().startsWith('File ')&&!line.includes('pyodide'))inTraceback = true;
      if(inTraceback)errMsg.push(line);
    }
    return errMsg.join('\n');
  }



  // special consideration for python input() vs await input()
  function wrapAwaitInput(codeString) {
    // Regex to match `await input(...)` with support for single, double, and triple quotes.
    const regex = /\bawait input\((("(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)*')|('''(?:[^']|'[^']|''[^'])*''')|("""(?:[^"]|"[^"]|""[^"])*""")|[^)]*)\)/g;
    return codeString.replace(regex, (match, p1, p2, p3, p4, p5) => {
      // The content is in the first matching group that is not undefined.
      const content = p1 || p2 || p3 || p4 || p5;
      return `(await input(${content}))`;
    });
  }
  function replaceInputCalls(codeString){
    codeString = codeString.replace(/\\\n/g,''); // remove escaped newlines (TODO: this is not optimal for error traces)
    const lines = codeString.split('\n');
    codeString = lines.map(l=>
      l.replace(/\binput\s*\(/g, 'await input(')                 // change all input( to await input(
        .replace(/\bawait\s+await input\(/g, 'await input(')      // change all await await input( to await input(
      //  .replace(/\bawait input\((.*?)\)/g, "(await input($1))")  // change all await input(...) to (await input(...))
    ).join('\n');
    return wrapAwaitInput(codeString);
  }
  function checkInputUse(code){
    const patterns = {
      reassignment: /\binput\s*=(?!=)/g,
      functionArgument: /^\s*def\s+\w+\s*\([^)]*\binput\b[^)]*\)/gm,
      functionDefinition: /^\s*def\s+input\s*\(/gm,
      classDefinition: /^\s*class\s+input\s*(?:\(|:)/gm,
      lambdaArgument: /\blambda\s+\binput\b/g,
    };
    let warnings = [];
    // Check for `input` function reassignment
    if (code.match(patterns.reassignment)) {
      warnings.push('Potential `input` function reassignment found.\n Reassigning built-in functions can cause unexpected behavior.');
    }
    // Check for `input` as a function argument
    if (code.match(patterns.functionArgument)) {
      warnings.push('The name `input` is being used as a function argument in a `def` statement.\n This will shadow the built-in `input` function inside the function scope.');
    }
    // Check for a custom `input` function definition
    if (code.match(patterns.functionDefinition)) {
      warnings.push('A custom function named `input` is being defined.\n This will overwrite the built-in `input` function.');
    }
    // New: Check for a custom `input` class definition with or without inheritance
    if (code.match(patterns.classDefinition)) {
      warnings.push('A custom class named `input` is being defined.\n This will overwrite the built-in `input` function.');
    }
    // New: Check for `input` as a lambda argument
    if (code.match(patterns.lambdaArgument)) {
      warnings.push('The name `input` is being used as a parameter in a `lambda` expression.\n This will shadow the built-in `input` function.');
    }
    return warnings;
  }


  // run python code via pyodide
  /**
   * Executes Python code asynchronously in a Pyodide kernel, handling input/output redirection,
   * error reporting, and cleanup of the global namespace prior to execution.
   *
   * @async
   * @function
   * @param {string} code - The Python code to execute.
   * @param {Object} [options] - Optional settings for code execution.
   * @param {boolean} [options.addAwaitToEveryInput=true] - Whether to replace `input()` calls with `await input()`.
   * @param {string} [options.filename='main.py'] - The filename to associate with the executed code.
   * @returns {Promise<void>} Resolves when code execution is complete.
   */
  async function run(pyId, code, options={}){
    await pyodideLoaded;
    await self.pythonKernel.loadPackagesFromImports(code);
    clearGlobalNamespace();
    // redirect stdout to a string buffer and display on the webpage
    self.pythonKernel.setStdout({write: chars=>postChars(pyId,chars)});
    // override Python's input() with a non-blocking handler
    self.pythonKernel.globals.set("input", prompt=>getInput(pyId,prompt));
    
    if(options.addAwaitToEveryInput??true){
      // replace `input()` calls with `await input()`
      code = replaceInputCalls(code);
      // check to see if user is trying to override built-in input() function
      checkInputUse(code).forEach(warning=>postWarning(pyId, 'WARNING: ' + warning));
    }
    
    // run code
    try{
      await self.pythonKernel.runPythonAsync(code, { filename: options.filename||'main.py' });
      self.pythonKernel.runPython('import sys; sys.stdout.flush()');
    }catch(err){
      postError( pyId, pythonError(err) );
    }
    // reset stdio
    self.pythonKernel.setStdout({write: chars=>chars.length});
    self.pythonKernel.globals.set("input", prompt=>{});

    return true;
  }


  /**
   * Executes Python code in a Pyodide kernel, simulating input and capturing output for unit testing.
   *
   * @async
   * @function unitTest
   * @param {string} code - The main Python code to execute.
   * @param {string} [testInput=''] - The input string to simulate user input, character by character.
   * @param {string} [testCode=''] - Additional Python code to execute after the main code.
   * @returns {Promise<string>} The captured output from the Python code execution, including stdout and simulated input.
   */
  const unitTest = async function(code, testInput, testCode, maxOutput=1000){
    // init
    clearGlobalNamespace();
    // redirect output
    var output = '';
    self.pythonKernel.setStdout({write: chars=>{
      output+=String.fromCharCode.apply(null, chars);
      if(output.length>maxOutput){
        output+='\n...max output size reached.';
        interruptBuffer[0] = 2;
      }
      return chars.length;
    }});
    // self.pythonKernel.setStdout({batched: msg=>output+=msg+'\n'});
    // redirect input
    testInput=testInput||'';
    let inputIndex = 0;
    const stdin = ()=>testInput[inputIndex++];
    self.pythonKernel.setStdin({read:buf=>{
      let char = stdin();
      if(!char)return 0;
      output+=char;
      buf[0] = char.charCodeAt(0);
      return 1;
    }});
    self.pythonKernel.globals.set("input", promptTxt=>{
      if(promptTxt)output+=promptTxt;
      let inputLine = '';
      let char=stdin();
      while(char && char!='\n'){
        inputLine+=char||'';
        char=stdin();
      }
      output+=inputLine+'\n';
      return inputLine;
    });
    // run code and return output
    try{
      await self.pythonKernel.runPythonAsync(`${code}`);
      if(testCode){
        await self.pythonKernel.runPythonAsync(`${testCode}`);
      }
      self.pythonKernel.runPython('import sys; sys.stdout.flush()');
    }catch(err){
      output+=pythonError(err);
    }
    return output;
  }
})();


