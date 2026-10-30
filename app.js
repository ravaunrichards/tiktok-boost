(function(){
  'use strict';
  var $ = function(id){ return document.getElementById(id); };

  // Animate hero counter
  var hero = $('heroCount');
  if(hero){
    var target = 12480, cur = 0, step = Math.ceil(target/60);
    var t = setInterval(function(){
      cur += step;
      if(cur >= target){ cur = target; clearInterval(t); }
      hero.textContent = cur.toLocaleString();
    }, 25);
  }

  // Package cards -> sync select
  var pkgSel = $('pkg');
  document.querySelectorAll('.plan .pick').forEach(function(btn){
    btn.addEventListener('click', function(){
      var plan = btn.closest('.plan');
      var val = plan.dataset.plan + '|' + plan.dataset.price + '|' + plan.dataset.eta;
      for(var i=0;i<pkgSel.options.length;i++){
        if(pkgSel.options[i].value === val){ pkgSel.selectedIndex = i; break; }
      }
      updateSummary();
      document.getElementById('order').scrollIntoView({behavior:'smooth'});
    });
  });

  // Schedule toggle
  var schedToggle = $('schedToggle'), schedWrap = $('schedWrap');
  schedToggle.addEventListener('change', function(){
    schedWrap.classList.toggle('hidden', !schedToggle.checked);
    updateSummary();
  });
  $('schedTime').addEventListener('change', updateSummary);
  pkgSel.addEventListener('change', updateSummary);
  $('username').addEventListener('input', updateSummary);

  function parsePkg(){
    var p = pkgSel.value.split('|');
    return { name:p[0], price:Number(p[1]), eta:Number(p[2]) };
  }

  function updateSummary(){
    var p = parsePkg();
    var user = $('username').value.trim().replace(/^@+/, '');
    $('sAcct').textContent = user ? '@' + user : '\u2014';
    $('sPkg').textContent = p.name;
    $('sEta').textContent = p.eta + 'h';
    $('sTotal').textContent = '$' + p.price;
    if(schedToggle.checked && $('schedTime').value){
      var d = new Date($('schedTime').value);
      $('sStart').textContent = isNaN(d) ? 'Immediately' : d.toLocaleString();
    } else {
      $('sStart').textContent = 'Immediately';
    }
  }
  updateSummary();

  // Validation helpers (text only, no HTML injection)
  function validUser(u){ return /^[A-Za-z0-9._]{2,24}$/.test(u); }
  function validEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

  var cdInterval = null;

  $('boostForm').addEventListener('submit', function(e){
    e.preventDefault();
    var user = $('username').value.trim().replace(/^@+/, '');
    var email = $('email').value.trim();
    var ok = true;
    $('userErr').textContent = '';
    $('emailErr').textContent = '';
    if(!validUser(user)){ $('userErr').textContent = 'Enter a valid TikTok username (letters, numbers, . or _).'; ok = false; }
    if(!validEmail(email)){ $('emailErr').textContent = 'Enter a valid email for order updates.'; ok = false; }
    if(!ok) return;

    var p = parsePkg();
    updateSummary();

    // Determine start + completion time
    var start = new Date();
    if(schedToggle.checked && $('schedTime').value){
      var sd = new Date($('schedTime').value);
      if(!isNaN(sd) && sd > start) start = sd;
    }
    var done = new Date(start.getTime() + p.eta * 3600 * 1000);

    var confirm = $('confirm');
    confirm.classList.remove('hidden');
    // textContent only -> safe against injection
    $('confirmMsg').textContent = 'Order placed for @' + user + ' \u2014 ' + p.name +
      ' package ($' + p.price + '). Updates will be sent to ' + email + '.';

    if(cdInterval) clearInterval(cdInterval);
    function tick(){
      var diff = done - new Date();
      if(diff <= 0){ $('cdTimer').textContent = 'Complete \u2713'; clearInterval(cdInterval); return; }
      var h = Math.floor(diff/3600000);
      var m = Math.floor(diff%3600000/60000);
      var s = Math.floor(diff%60000/1000);
      function pad(n){ return (n<10?'0':'')+n; }
      $('cdTimer').textContent = pad(h)+':'+pad(m)+':'+pad(s);
    }
    tick();
    cdInterval = setInterval(tick, 1000);
    confirm.scrollIntoView({behavior:'smooth', block:'center'});
  });
})();
