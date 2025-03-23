import{addElementTo,button,importStyleSheet,isArr,isStr,last,span}from"./common.js";import styles from"./popup.css"with{type:"css"};document.adoptedStyleSheets.push(styles);var popups=[];export function popup(e,t,s,n,o,p={}){p?.className?p.className+=" popup":p.className="popup",Object.assign(p,{tag:"dialog"});const a=addElementTo(document.body,p);return a.addEventListener("cancel",(e=>e.preventDefault())),popups.push(a),a._close=a.close,a.close=()=>{a.onDismiss&&a.onDismiss()||(popups=popups.filter((e=>e!==a)),a._close(),a.remove())},a.header=addElementTo(a,{tag:"h3"}),a.main=addElementTo(a),a.footer=addElementTo(a),a.onDismiss=o,isArr(e)||(e=[e]),isArr(t)||(t=[t]),isArr(s)||(s=[s]),e.forEach((e=>e&&a.header.appendChild(isStr(e)?span({innerHTML:e}):e))),t.forEach((e=>e&&a.main.appendChild(isStr(e)?span({innerHTML:e}):e))),s.forEach((e=>e&&a.footer.appendChild(isStr(e)?span({innerHTML:e}):e))),n&&(a.dismissBtn=addElementTo(a.footer,{tag:"button",textContent:n,events:{click:e=>a.close()}})),a.showModal(),a}export function confirmPopup(e,t,s,n,o,p){const a=popup(e,t,button({textContent:s,events:{click:e=>{n(),a.close()}}}),o,p);return a}function handleEscapeUp(e){if("Escape"===e.key){e.preventDefault();const t=last(popups);t.dismissBtn&&t.close()}}function handleEscapeDn(e){"Escape"===e.key&&e.preventDefault()}document.addEventListener("keydown",handleEscapeDn),document.addEventListener("keyup",handleEscapeUp);