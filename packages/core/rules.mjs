export const fields = ['from','to','subject','body','accountId','hasAttachment','unread'];
export const actionTypes = ['move','junk','trash','deletePermanently','autoReply','markRead','markUnread','flag','categorize'];
export function validateRule(rule) {
  if (!rule.id || !['all','any'].includes(rule.match) || !rule.conditions?.length || !rule.actions?.length) throw new Error('Rule requires id, match, conditions and actions');
  for (const c of [...rule.conditions,...(rule.exceptions || [])]) {
    if (!fields.includes(c.field) || !['equals','contains'].includes(c.operator) || !['string','boolean'].includes(typeof c.value)) throw new Error('Invalid condition');
    if (['hasAttachment','unread'].includes(c.field) && (typeof c.value !== 'boolean' || c.operator !== 'equals')) throw new Error('Boolean fields require equals and a boolean');
  }
  for (const a of rule.actions) {
    if (!actionTypes.includes(a.type)) throw new Error('Unknown action');
    if (['move','autoReply','categorize'].includes(a.type) && !a.value?.trim()) throw new Error('Action requires a value');
  }
  return rule;
}
const matches = (message,c) => {
  const value = message[c.field];
  if (value === undefined) return false;
  if (typeof c.value === 'boolean') return value === c.value;
  const a = String(value).toLowerCase(), b = c.value.toLowerCase();
  return c.operator === 'equals' ? a === b : a.includes(b);
};
// Pure planning only: adapters must separately authorize and execute actions.
export function planRules(message, rules) {
  const plans = [];
  for (const rule of rules) {
    validateRule(rule);
    if (!rule.enabled || (rule.accountId && rule.accountId !== message.accountId)) continue;
    if ((rule.exceptions || []).some(c => matches(message,c))) continue;
    if (!(rule.match === 'all' ? rule.conditions.every(c => matches(message,c)) : rule.conditions.some(c => matches(message,c)))) continue;
    plans.push({ruleId:rule.id,messageId:message.id,actions:rule.actions.map(a=>({...a}))});
    if (rule.stopProcessing) break;
  }
  return plans;
}
export function canAutoReply({automated=false, mailingList=false, fromSelf=false, lastReplyAt=null, now=Date.now(), cooldownMs=86400000}) {
  return !automated && !mailingList && !fromSelf && (lastReplyAt === null || now-lastReplyAt >= cooldownMs);
}
