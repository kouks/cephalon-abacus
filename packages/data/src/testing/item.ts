/** What every made-up item carries. */
export const item = <Id extends string>(id: Id) => ({
  id,
  name: id,
  source: 'https://wiki.warframe.com/w/Test',
  gameVersion: '44.1.4.1',
});
