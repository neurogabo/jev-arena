// Keep presentation changes out of the decision engine's version fingerprint.
const headline = document.querySelector('.intro h1');
headline.innerHTML = 'Play against<br><span class="ink-underline">Jev<span class="brand-dot">.</span></span>';

const board = document.getElementById('scoreboard');
async function refreshRecord() {
  try {
    const response = await fetch('/api/stats'); if (!response.ok) throw new Error();
    const stats = await response.json();
    board.replaceChildren();
    const title = document.createElement('p'); title.className='scoreboard-title'; title.textContent='Jev vs. people'; board.append(title);
    const list=document.createElement('dl'); list.className='scoreboard-numbers';
    for(const [label,value] of [['Jev wins',stats.jevWins],['Human wins',stats.humanWins],['Completed battles',stats.completed],['Jev win rate',stats.winRate===null?'—':`${(stats.winRate*100).toFixed(1)}%`]]) {
      const group=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value);group.append(dd,dt);list.append(group);
    }
    board.append(list);
    const detail=document.createElement('details'),summary=document.createElement('summary'),copy=document.createElement('p');
    summary.textContent='About this record';
    copy.textContent=`Completed live battles with the current Jev version. ${stats.draws} draws are included; ${stats.forfeits} forfeits are recorded separately. Abandoned games, technical failures and offline tests do not count. Repeat players can play more than once.`;
    detail.append(summary,copy);board.append(detail);
    const availabilityResponse = await fetch('/api/availability');
    if (availabilityResponse.ok) {
      const availability = await availabilityResponse.json();
      if (!availability.open) { const notice = document.createElement('p'); notice.setAttribute('role','status'); notice.textContent = availability.message; board.append(notice); }
    }
  } catch { board.textContent='The public record is temporarily unavailable.'; }
}
void refreshRecord();setInterval(()=>void refreshRecord(),15000);

const leaveDialog = document.getElementById('end-match-dialog');
document.getElementById('end-match').onclick = () => leaveDialog.showModal();
document.getElementById('end-match-cancel').onclick = () => leaveDialog.close();
document.getElementById('end-match-confirm').onclick = async event => {
  const button = event.currentTarget; button.disabled = true;
  try {
    const session = await (await fetch('/api/session')).json();
    if (session.active?.battleId) {
      const response = await fetch('/api/forfeit', { method:'POST', headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},
        body:JSON.stringify({battle:session.active.battleId,requestId:crypto.randomUUID()}) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || result.error);
    }
    leaveDialog.close(); location.reload();
  } catch(error) { document.getElementById('end-match-error').textContent = error.message || 'Unable to leave. Please reconnect.'; }
  finally { button.disabled = false; }
};
