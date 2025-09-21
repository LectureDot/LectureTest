
function preventDefault(event){
  event.preventDefault();
}

export function preventCopyPasteAndAutofill(){
  // Prevent text selection
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';

  // Blocks copy-pasting from clipboard
  document.addEventListener("copy", preventDefault);
  document.addEventListener("paste", preventDefault);

  // Disabling AI tools
  document.querySelectorAll("input, textarea").forEach(field => {
    field.setAttribute("autocomplete", "off"); // Disable browser autofill
    field.setAttribute("autocorrect", "off");  // Disable AI text suggestions
    field.setAttribute("spellcheck", "false"); // Prevent spelling suggestions
    field.setAttribute("autocapitalize", "off"); // Prevent AI suggestions
    field.setAttribute("data-gramm", "false"); // Prevent Grammarly AI
    field.setAttribute("data-gramm_editor", "false"); // Prevent Grammarly AI
    field.setAttribute("data-enable-grammarly", "false"); // Prevent Grammarly AI
    field.setAttribute("aria-autocomplete", "none"); // Prevent AI autocomplete
    field.setAttribute("aria-multiline", "false"); // Suggests it’s not for AI-generated text
    field.setAttribute("data-lpignore", "true"); // Prevents LastPass autofill
    field.setAttribute("data-form-type", "other"); // Prevents Chrome autofill
    field.setAttribute("data-autocompleted", "false"); // Attempts to disable AI completion
  });

  document.querySelectorAll("input[type='text'], textarea").forEach(field => {
    // Skip if this textarea is used by CodeMirror
    if (field.classList.contains("CodeMirror")) return; 
    if (field.closest(".CodeMirror")) return;  

    field.setAttribute("readonly", true); // Prevent AI autofill initially
    field.addEventListener("focus", () => field.removeAttribute("readonly")); // Allow human focus

    // Block AI-generated inputs but allow real typing
    field.addEventListener("input", (event) => {
        if (event.isTrusted) {
            // Human input (allowed)
            return;
        } else {
            // AI/autofill detected (blocked)
            event.target.value = ""; // Clear AI-injected text
        }
    });
  });

  // Prevent AI-generated text in CodeMirror
  if (window.CodeMirror) {
      CodeMirror.defineExtension("blockAIInput", function () {
          this.on("beforeChange", (cm, change) => {
              if (!change.origin || change.origin !== "paste") return; // Allow normal typing
              change.cancel(); // Block AI pasting
          });
      });

      // Apply the fix to all CodeMirror instances
      document.querySelectorAll(".CodeMirror").forEach(cmElem => {
          let cm = cmElem.CodeMirror;
          if (cm) cm.blockAIInput();
      });
  }

}

export function reenableCopyPaste(){
  // Re-enable text selection
  document.body.style.userSelect = 'auto';
  document.body.style.webkitUserSelect = 'auto';

  // Re-enable copy/paste
  document.removeEventListener("copy", preventDefault);
  document.removeEventListener("paste", preventDefault);
}

