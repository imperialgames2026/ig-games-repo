export const COLLECTION_REVIEW_BRANCH='review/latest-game-collection-20261101';
export function collectionReviewEnabled({mode,cfBranch,vercelBranch}={}){return mode==='collection-review'||cfBranch===COLLECTION_REVIEW_BRANCH||vercelBranch===COLLECTION_REVIEW_BRANCH;}
