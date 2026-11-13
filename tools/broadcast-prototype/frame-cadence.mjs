// Match scheduled composition to the encoder rate, independent of monitor Hz.
// Callers may still draw an immediate frame for a hidden sanctuary output.
export function createFrameCadence(fps=30) {
 const interval=1000/fps;
 let next;
 return now=>{
  if(next===undefined){next=now+interval;return true;}
  if(now+0.01<next)return false;
  next+=Math.max(1,Math.floor((now-next+0.01)/interval)+1)*interval;
  return true;
 };
}
