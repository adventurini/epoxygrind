(()=>{(function(){let l=`
    .eg-chat-bubble{position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;background:#1A5CD6;color:#fff;border:none;box-shadow:0 8px 24px rgba(26,92,214,.35);cursor:pointer;z-index:9999;display:flex;align-items:center;justify-content:center;font-size:26px;transition:transform .15s}
    .eg-chat-bubble:hover{transform:scale(1.06)}
    .eg-chat-panel{position:fixed;bottom:92px;right:20px;width:320px;max-width:calc(100vw - 40px);background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(17,33,59,.25);z-index:9999;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;display:flex;flex-direction:column}
    .eg-chat-head{background:#1A5CD6;color:#fff;padding:16px 18px}
    .eg-chat-head h3{margin:0;font-size:15px;font-weight:700}
    .eg-chat-head p{margin:4px 0 0;font-size:12.5px;opacity:.9}
    .eg-chat-body{padding:16px 18px;display:flex;flex-direction:column;gap:10px}
    .eg-chat-bubble-msg{background:#F0F2F6;border-radius:12px;padding:10px 13px;font-size:13.5px;line-height:1.4;color:#11213B;align-self:flex-start;max-width:90%}
    .eg-chat-field label{display:block;font-size:11px;font-weight:600;color:#647189;margin-bottom:4px}
    .eg-chat-field input,.eg-chat-field textarea{width:100%;box-sizing:border-box;font-family:inherit;font-size:13.5px;padding:9px 11px;border:1px solid #DCE1EA;border-radius:8px}
    .eg-chat-field textarea{resize:none}
    .eg-chat-submit{background:#1A5CD6;color:#fff;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:700;cursor:pointer;margin-top:2px}
    .eg-chat-submit:disabled{opacity:.6;cursor:default}
    .eg-chat-error{color:#B3261E;font-size:12px;display:none}
    .eg-chat-success{padding:16px 18px;font-size:14px;line-height:1.5;color:#11213B}
    .eg-chat-close{position:absolute;top:12px;right:14px;background:none;border:none;color:#fff;font-size:16px;cursor:pointer;opacity:.85}
  `,r=document.createElement("style");r.textContent=l,document.head.appendChild(r);let t=document.createElement("button");t.className="eg-chat-bubble",t.setAttribute("aria-label","Open chat"),t.textContent="\u{1F4AC}",document.body.appendChild(t);let e=document.createElement("div");e.className="eg-chat-panel",e.style.display="none",e.innerHTML=`
    <div class="eg-chat-head" style="position:relative">
      <button class="eg-chat-close" type="button" aria-label="Close">\u2715</button>
      <h3>EpoxyGrind</h3>
      <p>Curious how instant text-back works?</p>
    </div>
    <div class="eg-chat-body">
      <div class="eg-chat-bubble-msg">\u{1F44B} Drop your number and we'll text you right now \u2014 from the exact same system your customers would get.</div>
      <form id="egChatForm">
        <div class="eg-chat-field" style="margin-bottom:10px">
          <label for="egChatPhone">Phone number</label>
          <input id="egChatPhone" type="tel" placeholder="(555) 123-4567" required>
        </div>
        <div class="eg-chat-field" style="margin-bottom:10px">
          <label for="egChatMessage">Anything you want to ask? (optional)</label>
          <textarea id="egChatMessage" rows="2" placeholder="e.g. how much does this cost?"></textarea>
        </div>
        <p class="eg-chat-error" id="egChatError"></p>
        <button class="eg-chat-submit" type="submit" id="egChatSubmit">Text me \u2192</button>
      </form>
    </div>
  `,document.body.appendChild(e);function s(o){e.style.display=o?"flex":"none",t.textContent=o?"\u2715":"\u{1F4AC}"}t.addEventListener("click",()=>s(e.style.display==="none")),e.querySelector(".eg-chat-close").addEventListener("click",()=>s(!1)),e.querySelector("#egChatForm").addEventListener("submit",async o=>{o.preventDefault();let d=document.getElementById("egChatPhone").value.trim(),c=document.getElementById("egChatMessage").value.trim(),i=document.getElementById("egChatError"),a=document.getElementById("egChatSubmit");i.style.display="none",a.disabled=!0,a.textContent="Sending\u2026";try{let n=await fetch("/api/webhooks/web/capture",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:d,message:c})}),p=await n.json();if(!n.ok)throw new Error(p.error||"Something went wrong.");document.querySelector(".eg-chat-body").outerHTML='<div class="eg-chat-success">\u{1F4F1} Check your phone! We just texted you from the same number your customers would call. Reply anytime \u2014 a real person will pick it up.</div>'}catch(n){i.textContent=n.message||"Something went wrong \u2014 try again.",i.style.display="block",a.disabled=!1,a.textContent="Text me \u2192"}})})();})();
