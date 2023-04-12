export function ancestryAndSelf (root, bigIndex) {
  const parents = [root.value || root];
  let curNode = root.value || root;
  while (curNode?.parent_table && curNode.parent_id) {
    const { parent_table: pTable, parent_id: pId } = curNode;
    if (pTable === 'space' || pTable === 'team') break;
    if (!bigIndex[pTable][pId]) console.warn(`NOT FOUND ${pTable}/${pId} for ${curNode.id}`);
    curNode = bigIndex[pTable][pId].value;
    parents.unshift(curNode);
  }
  return parents;
}
