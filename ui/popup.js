import{addElementTo,button,isArr,isStr,span}from"./common.js";import styles from"./popup.css"with{type:"css"};document.adoptedStyleSheets.push(styles);var popups=[];export function popup(e,s,t,n,o,p={}){p?.className?p.className+=" popup":p.className="popup",Object.assign(p,{tag:"dialog"});const a=addElementTo(document.body,p);return a.addEventListener("cancel",(e=>e.preventDefault())),popups.push(a),a._close=a.close,a.close=()=>{a.onDismiss&&a.onDismiss()||(popups=popups.filter((e=>e!==a)),a._close(),a.remove())},a.header=addElementTo(a,{tag:"h3"}),a.main=addElementTo(a),a.footer=addElementTo(a),a.onDismiss=o,isArr(e)||(e=[e]),isArr(s)||(s=[s]),isArr(t)||(t=[t]),e.forEach((e=>e&&a.header.appendChild(isStr(e)?span({innerHTML:e}):e))),s.forEach((e=>e&&a.main.appendChild(isStr(e)?span({innerHTML:e}):e))),t.forEach((e=>e&&a.footer.appendChild(isStr(e)?span({innerHTML:e}):e))),n&&(a.dismissBtn=addElementTo(a.footer,{tag:"button",textContent:n,events:{click:e=>a.close()}})),a.showModal(),a}export function confirmPopup(e,s,t,n,o,p){const a=popup(e,s,button({textContent:t,events:{click:e=>{n(),a.close()}}}),o,p);return a}function handleEscapeUp(e){if("Escape"===e.key){e.preventDefault();const s=popups.at(-1);s.dismissBtn&&s.close()}}function handleEscapeDn(e){"Escape"===e.key&&e.preventDefault()}document.addEventListener("keydown",handleEscapeDn),document.addEventListener("keyup",handleEscapeUp);