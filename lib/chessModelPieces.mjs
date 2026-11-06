// GLTFLoader removes dots from Blender's .001 duplicate suffixes. Match both
// names without treating that suffix as part of the chess piece kind.
export function chessModelTemplateKey(node){
 const match=/^Piece_([KQRBNP])(?:[._]?\d+)?$/.exec(node?.name||'');
 return match?(node.position.z>0?'w':'b')+match[1]:null;
}
