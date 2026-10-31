export function vietnamClock(now:number){const local=new Date(now+7*60*60*1000).toISOString();return {date:local.slice(0,10),time:local.slice(11,16)};}
