import { arrMean, arrStderr, groupAndSummarize, newEl } from './common.js';
import { popup } from './popup.js';
import { showQuestion } from '../showQuestions.js';
import { grid } from './grid.js';
import {} from './chart.js';
import {} from './chartjs-plugin-zoom.js';
import {} from './chartjs-plugin-annotation.js';

Chart.defaults.color = '#a5a5a5'; // Text color for all labels
Chart.defaults.borderColor = '#aaa'; // Grid line color
Chart.defaults.plugins.legend.labels.color = '#a5a5a5'; // Legend text color
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(0, 0, 0, 1)'; // Tooltip background color
Chart.defaults.backgroundColor = ['#679436', '#a6d96a', '#f4a261', '#e76f51', '#ef233c','#d80032'];

// Parses a string to get the lower and upper contents of a bar bin
function getBounds(rangeStr) {
  const [lower, upper] = rangeStr.split('-').map(num => parseFloat(num.trim()));
  return { lower, upper };
}

// Function to calculate histogram bins and frequencies
function calculateHistogram(values) {
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const numBins = Math.ceil(2 * Math.cbrt(values.length));
  const binWidth = (maxValue - minValue) / numBins;
  // Initialize bins
  const bins = Array.from({ length: numBins }, (_, i) => ({
      range: `${(minValue + i * binWidth).toFixed(1)} - ${(minValue + (i + 1) * binWidth).toFixed(1)}`,
      count: 0
  }));
  // Count occurrences in bins
  values.forEach(value => {
      const index = Math.min(Math.floor((value - minValue) / binWidth), numBins - 1);
      bins[index].count++;
  });
  return bins;
}

function linearRegression(data) {
  const n = data.length;
  const sumX = data.reduce((sum, p) => sum + p.x, 0);
  const sumY = data.reduce((sum, p) => sum + p.y, 0);
  const sumXY = data.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = data.reduce((sum, p) => sum + p.x * p.x, 0);

  const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const b = (sumY - m * sumX) / n;

  return { m, b };
}

function getRegressionLine(data, minX, maxX) {
  const { m, b } = linearRegression(data);
  return [{ x: minX, y: m * minX + b }, { x: maxX, y: m * maxX + b }];
}

// Draws a popup with either a bar graph or pie chart to drill down into the data
function zoomPopup(values, exam, title, xlab, ylab){
  if (!Array.isArray(values.data) || values.data.length<=1) return;
   const p = popup('','',null,'Dismiss',null,{style:{width:'600px', height:'600px'}});
   const uniqueCategories = new Set(values.data);
   if (uniqueCategories.size<5){
    const intermediate = groupAndSummarize( 
      values.data.map((category, index) => ({category, label: values.content[index]})),
      {
        groupBy: 'category',
        valuesField: 'category', 
        labelField: 'label'
      }
    );
    const result = {
      labels: intermediate.labels,
      data: intermediate.data.map(arr => arr.length),  // count instead of values
      content: intermediate.content
    };
    drawPie(p.main, result, title);
   }
   else {
    drawBar(p.main, values, exam, title, xlab, ylab);
   }
}

// Shows a table of contents when bar or pie element are clicked
function showContents(data,label,title,title2){
  let index, values;
  index = values = -1;
  data?.labels ? data.labels.forEach((lab,i) => {if (lab==label){index=i;}}) : '';
  console.log(data)
  if (index==-1){
    //we have a range of values in label, need to get upper and lower bound and filter values based on that instead
    let bounds = getBounds(label);
    values=[];
    data.data.forEach((val,i) => {
      if (bounds.lower<=val && bounds.upper>=val){
      values.push([data.content[i],val.toFixed(2)]);
    }});
  }
  else{
    values=data.content ? data.content[index].map(v=>[v,label]) : [];
  }
  if (values.length>0){
    let p = popup((title2!=title? title2 : '') +' '+title+' : '+label,'',null,'Dismiss');
    let qpane = newEl({},p.main);
    var table=grid(["Element","Value"],[],{},p.main);
    values.forEach(v => {
      table.addRow([v[0],v[1]]);
  })}
}

// Function to copy the chart while removing tooltips
function copyChartToClipboard(chartInstance) {
  const canvas = chartInstance.canvas;
  const originalTooltip = chartInstance.options.plugins.tooltip.enabled; 
  // Temporarily disable tooltips
  chartInstance.options.plugins.tooltip.enabled = false;
  chartInstance.update();

  setTimeout(() => {
      canvas.toBlob(blob => {
          const item = new ClipboardItem({ "image/png": blob });
          navigator.clipboard.write([item]).then(() => {
              console.log("Chart copied to clipboard!");
          }).catch(err => {
              console.error("Failed to copy:", err);
          });

          // Restore tooltips after copying
          chartInstance.options.plugins.tooltip.enabled = originalTooltip;
          chartInstance.update();
      });
  }, 200);
}

// Draw a Histogram with SD error bars
// If passing an array, will automatically bin the array and plot that instead of the means of each category
export function drawBar(pane, data1, exam, title, xlab, ylab, numSubjects, cc=false, referenceValue){
  var labels, values, stdDevs, maxYValue, dataCounts;
  pane.innerHTML='';
  if (Array.isArray(data1) || data1.labels == undefined) {
    const histogramData = calculateHistogram(data1.data);
    labels = histogramData.map(bin => bin.range);
    values = histogramData.map(bin => bin.count);
    stdDevs = dataCounts = labels.map(category => 0);
    maxYValue = labels.map(category => Math.max(values));
  }
  else {
    labels = data1.labels;
    values = data1.data.map(arrMean);
    stdDevs = data1.data.map(arrStderr);
    maxYValue = Math.max(...values.map((mean, index) => mean + stdDevs[index]));
    dataCounts = data1.data.map(v =>{
      if (!Array.isArray(v)) v=[v]; 
      return v.filter(value => value !== undefined).length
    });
  }
  if (labels.length>25){
    var container = newEl({className:'toggle-container'},pane);
    var label  = newEl({tag:'label',className:'toggle-switch'},container);
    var toggleSwitch = newEl({tag:'input',id:'toggleSwitch',type:'checkbox'},label);
    var slider = newEl({tag:'span',className:'slider'},label);
    var toggleLabel = newEl({tag:'span',id:'toggleLabel',className:'toggle-label',textContent:'Show Question'},container);
  }
  var canvas = newEl({tag:'canvas', id:pane.id},pane);
  var ctx = canvas.getContext('2d');
  const qPoints = labels.map(category => {
    let q = exam.questions.find(question => question.id === category);
    return q?.points || 0;
  });

  // Define colors based on counts of data points compared to numSubjects
  const colors = {
    low: 'rgba(255, 99, 132, 0.8)',  // Red
    medium: 'rgba(255, 206, 86, 0.8)', // Yellow
    high: 'rgba(75, 192, 192, 0.8)' // Green
  };
  
  // Assign colors dynamically
  const backgroundColors = dataCounts.map(point => {
    var cat = 'high'; 
    if (cc){
      cat = point < numSubjects*.33 ? 'low' : point > numSubjects*.8 ? 'high' : 'medium'; 
    }
    return colors[cat];}
  );

  // Reference Line plugin
  const refLine = {
    id: "referenceLine",
    afterDraw(chart) {
      if (referenceValue === undefined || referenceValue === null) return; // Skip drawing
      const { ctx, scales: { y } } = chart;
      const yPos = y.getPixelForValue(referenceValue);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(chart.chartArea.left, yPos);
      ctx.lineTo(chart.chartArea.right, yPos);
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
  }};

  // Custom plugin for error bars
  const errorBarPlugin = {
    id: 'errorBars',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = 'white'; // Error bar color
      ctx.lineWidth = 1.5;

      chart.data.datasets.forEach((dataset, datasetIndex) => {
        if (!dataset.errorBars) return; // Skip if no error bars

        const meta = chart.getDatasetMeta(datasetIndex);
        meta.data.forEach((bar, index) => {
          const error = dataset.errorBars[index]; // { lower, upper }
          if (!error || error.lower === error.upper) return;
          
          const x = bar.x;
          const yLower = chart.scales.y.getPixelForValue(error.lower);
          const yUpper = chart.scales.y.getPixelForValue(error.upper);

          // Draw vertical error bar
          ctx.beginPath();
          ctx.moveTo(x, yLower);
          ctx.lineTo(x, yUpper);
          ctx.stroke();

          // // Draw small horizontal caps
          // ctx.beginPath();
          // ctx.moveTo(x - 5, yLower);
          // ctx.lineTo(x + 5, yLower);
          // ctx.moveTo(x - 5, yUpper);
          // ctx.lineTo(x + 5, yUpper);
          // ctx.stroke();
        });
      });

      ctx.restore();
    }
  };

  const chartData = {
    labels: labels, 
    datasets: [{
        data: values,
        backgroundColor: backgroundColors,
        errorBars: values.map((mean, index) => ({ lower: mean - stdDevs[index], upper: mean + stdDevs[index] })) // Error bars
    }]
  };

  const chartOptions = {
    responsive: true,
    onClick: (event, elements) => {
       if (elements.length > 0) {
          const index = elements[0].index;  // Get index of the clicked item
          const category = myChart.data.labels[index];  // Get the category name
          const content = data1?.content ? data1.content[index] : '';
          let q = exam.questions.find(question => question.id === category);
          let a = exam.answers[category];
          if (toggleSwitch?.checked){  //show the question
            if (q) {
              let p = popup(category,'',null,'Dismiss');
              let qpane = newEl({innerHTML:"Answer: "+a},p.main);
              showQuestion(qpane,q,q.id,exam.answers,exam.answers[q.id]);
            }}
          else {  //otherwise, show the distribution or if no distribution then the content if it exists
              copyChartToClipboard(event.chart);
              if(data1?.data && Array.isArray(data1.data[index]) && data1.data[index].length>1) { 
                zoomPopup({data:data1.data[index],content:content}, exam, category, ylab ? ylab : category, "Frequency");
              }
              else{
                showContents(data1,category,xlab,title);
              }
          }
      }
    },
    plugins: {
        title: {
          display: true,
          text: title, // Title text
          font: {
              size: 25 // Adjust font size
          },
          padding: {
              top: 10,
              bottom: 20
          },
            color: '#aaa' // Title color
        },
        legend: {
            display: false,
        },
        tooltip: {
            callbacks: {
              label: function (tooltipItem) {
                const index = tooltipItem.dataIndex;
                return [
                  `Value: ${tooltipItem.raw.toFixed(2)}`,
                  dataCounts[index] > 1 ? `Count: ${dataCounts[index]}` : '',
                  qPoints[index] != 0 ? `Worth: ${qPoints[index]}` : ''
              ].filter(Boolean); // Removes empty elements
              }
            }
        },
        annotation: {
          annotations: {
            referenceLine: {
              type: "line",
              yMin: referenceValue || 0,
              yMax: referenceValue || 0,
              label: {
                content: "Target",
                enabled: true,
                position: "end"
              }
        }}},
        zoom: { pan: {enabled: true, mode: "xy"},
                zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "xy"}
        }
    },
    scales: {
      x: {
        title: {display: true, text: xlab},
        ticks: {display: true},
        grid: {display: false}
      },
      y: {
        title: {display: true, text: ylab},
        // type: 'logarithmic',
        beginAtZero: true,
        max: Math.max(maxYValue,referenceValue||0),
        grid: { color: 'rgba(207, 196, 196, 0.4)'}
      },
    },
    maintainAspectRatio: false,
  };

  // Create the chart
  const myChart = new Chart(ctx, {
      id: 'myChart',
      type: 'bar',
      data: chartData,
      options: chartOptions,
      plugins: [errorBarPlugin, refLine]
  });

  pane.addEventListener("dblclick", () => {
    myChart.resetZoom();
  });
}

// Draw a Pie Chart of the Data
export function drawPie(pane, data1, title) {
  let labels = data1.labels;
  let data2 = data1.data;
  let total = data2.reduce((acc, val) => acc + val, 0);
  pane.innerHTML='';
  var canvas = newEl({ tag: 'canvas', id: pane.id },pane);
  var ctx = canvas.getContext('2d');
  const data = {
      labels: labels,
      datasets: [{
          //label: 'Question Type',
          data: data2,
          borderWidth: 1,
          borderColor: 'rgb(43,27,13)'
      }]
  };

  const config = {
      type: 'pie',
      data: data,
      options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: 0 },
          onClick: (event, elements) => {
              if (elements.length > 0) {
                const index = elements[0].index;  // Get index of the clicked item
                const category = labels[index];  // Get the category name
                copyChartToClipboard(event.chart); // Pass Chart instance
                showContents(data1,category,"",title);
              }
          },
          plugins: {
              title: {
                display: true,
                text: title, // Title text
                font: {
                    size: 25 // Adjust font size
                },
                padding: {
                    top: 10,
                    bottom: 20
                },
                  color: '#aaa' // Title color
              },
              legend: {
                  position: 'left',
                  labels: {
                      boxWidth: 10,
                      font: { size: 20 },
                      color: '#a5a5a5'
                  }
              },
              tooltip: {
                  enabled: true, // Tooltip enabled by default
                  callbacks: {
                    label: function (tooltipItem) {
                      const index = tooltipItem.dataIndex;
                      return [
                        `${tooltipItem.raw.toFixed(2)} (${100*(tooltipItem.raw/total).toFixed(2)}%)`
                    ].filter(Boolean); // Removes empty elements
                    }
                  }
              }
          }
      }
  };

  const myChart = new Chart(ctx, config);
}

// Draws a scatter plot with a regression line
export function drawScatter (pane, scatterData, title, xlab, ylab, labels){
  if (arrStderr(scatterData.map(v=>v.y))==0 || arrStderr(scatterData.map(v=>v.x))==0) {
    pane.innerHTML+='<p>All points have the same value. Cannot plot regression line.</p>';
    return;
  }
  pane.innerHTML='';
  var canvas = newEl({tag:'canvas', id:pane.id, style:{width:'100%', height:'100%'}},pane);
  var ctx = canvas.getContext('2d');
  var minX = Math.min(...scatterData.map(v=>v.x));
  var maxX = Math.max(...scatterData.map(v=>v.x));
  var minY = Math.min(...scatterData.map(v=>v.y));
  var maxY = Math.max(...scatterData.map(v=>v.y));
  // const scatterData = x.map((xValue, index) => ({
  //   x: xValue,
  //   y: y[index]
  // }));
  const { m, b } = linearRegression(scatterData);
  const regressionLine = getRegressionLine(scatterData, minX, maxX);

  // Step 1: Divide the scatter plot into grid zones
  const gridRows = 3;
  const gridCols = 3;
  const zoneCounts = Array.from({ length: gridRows * gridCols }, () => 0);

  // Step 2: Count how many points fall into each zone
  scatterData.forEach(({ x, y }) => {
    const col = Math.floor(((x - minX) / (maxX - minX)) * gridCols);
    const row = Math.floor(((y - minY) / (maxY - minY)) * gridRows);
    const idx = row * gridCols + col;
    if (zoneCounts[idx] !== undefined) zoneCounts[idx]++;
  });

  // Step 3: Find the least populated zone
  const minZoneIndex = zoneCounts.indexOf(Math.min(...zoneCounts));
  const zoneRow = Math.floor(minZoneIndex / gridCols);
  const zoneCol = minZoneIndex % gridCols;

  // Step 4: Place label in center of that zone
  const labelX = minX + ((zoneCol + 0.5) / gridCols) * (maxX - minX);
  const labelY = minY + ((zoneRow + 0.5) / gridRows) * (maxY - minY);

  const scatterChartData = {
      datasets: [
          {
              label: '',
              data: scatterData,
              backgroundColor: 'rgba(70, 193, 230, 0.4)',
              pointRadius: 5
          },
          {
              label: 'Regression Line',
              data: regressionLine,
              type: 'line', // Ensure it's drawn as a line
              borderColor: 'red',
              borderWidth: 1,
              fill: false,
              pointRadius: 0 // Hide points for regression line
          }
      ]
  };

  const scatterChart = new Chart(ctx, {
    type: 'scatter',
    data: scatterChartData,
    options: {
        plugins: {
          title: {
            display: true,
            text: title, // Title text
            font: {
                size: 25 // Adjust font size
            },
            padding: {
                top: 10,
                bottom: 20
            },
              color: '#aaa' // Title color
          },
          legend: {
            display: false,
          },
          annotation: {
              annotations: {
                  equationLabel: {
                      type: 'label',
                      content: `y = ${m.toFixed(2)}x + ${b.toFixed(2)}`,
                      xValue: labelX, // Adjust position
                      yValue: labelY, // Adjust position
                      backgroundColor: '#acacac',
                      font: { size: 14, weight: 'bold', color: 'white' },
                      padding: 6
                  }
              }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const point = context.raw;
                return [`${point.label || 'Point'}`,`(${point.x.toFixed(2)}, ${point.y.toFixed(2)})`];
              }
            }
          }          
        },
        scales: { 
            x: { type: 'linear', position: 'bottom', title: {display: true, text: xlab}, grid: { color: 'rgba(207, 196, 196, 0.4)'} }, 
            y: { beginAtZero: true, title: {display: true, text: ylab}, grid: { color: 'rgba(207, 196, 196, 0.4)'} } 
        }
    }
});
}

// Function to calculate uniform distribution
function uniformDistribution(x, min, max) {
  if (x >= min && x <= max) {
      return 1 / (max - min); // Uniform probability density
  }
  return 0;
}

// Function to calculate normal distribution
function normalDistribution(x, mean, stdDev) {
  return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * 
         Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
}



  // // Example Data: Two groups, each with 4 time points and 3 samples per point
  // const rawData = [
  //   [ [10, 12, 14, 16], [11, 13, 15, 17], [9, 11, 13, 15] ], // Group A (3 samples per x)
  //   [ [8, 10, 12, 14], [9, 11, 13, 15], [7, 9, 11, 13] ]     // Group B (3 samples per x)
  // ];

  // const groupNames = ["Group A", "Group B"];
  // const colors = ["rgba(255, 99, 132, 0.5)", "rgba(54, 162, 235, 0.5)"];

  // // Process the raw data
  // const processedData = processData(rawData, groupNames, colors);

  // Draw the charts
  // var canvas = newEl({tag:'canvas', id:"myPieChart"},qTimePerType);
  // var ctx = canvas.getContext('2d');
  // drawLinePlotWithCI(ctx, processedData);

  // var canvas = newEl({tag:'canvas', id:"myPieChart"},qTimePerQ);
  // var ctx = canvas.getContext('2d');
  // drawLinePlotWithErrorBars(ctx, processedData);


//   // Function to calculate confidence intervals (95%)
// function calculateConfidenceInterval(values) {
//   const avg = arrMean(values);
//   const stdDev = arrStdev(values);
//   const n = values.length;
//   const marginOfError = 1.96 * (stdDev / Math.sqrt(n)); // 95% CI
//   return { mean: avg, lower: avg - marginOfError, upper: avg + marginOfError };
// }

//   // Function to process a list of lists and return structured data
// function processData(rawData, groupNames, colors) {
//   return rawData.map((groupData, groupIndex) => {
//       const processed = groupData[0].map((_, i) => {
//           const valuesAtX = groupData.map(row => row[i]); // Extract all y-values at x=i
//           return calculateConfidenceInterval(valuesAtX);
//       });

//       return {
//           name: groupNames[groupIndex],
//           color: colors[groupIndex],
//           values: processed
//       };
//   });
// }



  // Function to draw the line plot with confidence intervals
// function drawLinePlotWithCI(ctx, dataset) {
//   const datasets = dataset.map(group => ({
//       label: group.name,
//       data: group.values.map((v, i) => ({ x: i, y: v.mean })),
//       borderColor: group.color,
//       backgroundColor: group.color,
//       borderWidth: 2,
//       fill: false,
//       pointRadius: 3,
//       tension: 0.3
//   }));

//   // Confidence Interval datasets (shaded area)
//   dataset.forEach(group => {
//       datasets.push({
//           label: `${group.name} CI`,
//           data: group.values.map((v, i) => ({ x: i, y: v.upper })),
//           borderColor: 'transparent',
//           backgroundColor: group.color,
//           fill: '+1',
//           tension: 0.3
//       });

//       datasets.push({
//           label: `${group.name} CI`,
//           data: group.values.map((v, i) => ({ x: i, y: v.lower })),
//           borderColor: 'transparent',
//           backgroundColor: group.color,
//           fill: '-1',
//           tension: 0.3
//       });
//   });

//   new Chart(ctx, {
//       type: 'line',
//       data: { datasets },
//       options: {
//           plugins: { legend: { display: true } },
//         scales: {
//       x: {
//           type: 'linear', // 👈 Ensures numerical x-axis
//           position: 'bottom',
//           title: { display: true, text: 'X Axis' },
//           ticks: { stepSize: 1 } // Ensures integer spacing
//       },
//       y: {
//           title: { display: true, text: 'Y Axis' },
//           ticks: { stepSize: 1 }
//       }          
//           }
//       }
//   });
// }

// // Chart.js Plugin for Error Bars
// const errorBarPlugin1 = {
//     id: 'errorBars',
//     afterDraw(chart) {
//         const ctx = chart.ctx;
//         ctx.save();
//         ctx.strokeStyle = '#c8553d'; // Error bar color
//         ctx.lineWidth = 1.5; 

//         chart.data.datasets.forEach((dataset, datasetIndex) => {
//             if (!dataset.errorBars) return; // Skip if no error bars

//             const meta = chart.getDatasetMeta(datasetIndex);
//             meta.data.forEach((point, i) => {
//                 const error = dataset.errorBars[i]; // { lower, upper }
//                 if (!error) return;

//                 const x = point.x;
//                 const yLower = chart.scales.y.getPixelForValue(error.lower);
//                 const yUpper = chart.scales.y.getPixelForValue(error.upper);

//                 // Draw vertical error bar
//                 ctx.beginPath();
//                 ctx.moveTo(x, yLower);
//                 ctx.lineTo(x, yUpper);
//                 ctx.stroke();

//                 // Draw small horizontal caps
//                 ctx.beginPath();
//                 ctx.moveTo(x - 5, yLower);
//                 ctx.lineTo(x + 5, yLower);
//                 ctx.moveTo(x - 5, yUpper);
//                 ctx.lineTo(x + 5, yUpper);
//                 ctx.stroke();
//             });
//         });

//         ctx.restore();
//     }
// };

// // Function to draw the line plot with error bars
// function drawLinePlotWithErrorBars(ctx, dataset) {
//     const datasets = dataset.map(group => ({
//         label: group.name,
//         data: group.values.map((v, i) => ({ x: i, y: v.mean })), // Line data
//         borderColor: group.color,
//         backgroundColor: group.color,
//         borderWidth: 2,
//         pointRadius: 4,
//         tension: 0.3, // Smooth curve
//         errorBars: group.values.map(v => ({ lower: v.lower, upper: v.upper })) // Store error bars
//     }));

//     new Chart(ctx, {
//         type: 'line',
//         data: { datasets },
//         options: {
//             plugins: { legend: { display: true } },
//             scales: {
//                 x: {
//                     type: 'linear',
//                     position: 'bottom',
//                     title: { display: true, text: 'X Axis' },
//                     ticks: { stepSize: 1 }
//                 },
//                 y: { title: { display: true, text: 'Y Axis' } }
//             }
//         },
//         plugins: [errorBarPlugin1] // Add error bars
//     });
// }