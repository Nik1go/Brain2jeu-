import { collection, doc, getCountFromServer, getDocFromServer, getDocsFromServer, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { playerDatabase } from '../auth/database';
import { BOARDS, standingFromCounts } from './model';
import type { BoardId, LeaderboardEntry, Standing } from './model';

export const PAGE_SIZE = 20;
function entries(board: BoardId) {
  if (!BOARDS.some(item => item.id === board)) throw new Error('leaderboards/invalid-board');
  return collection(playerDatabase(), 'leaderboards', board, 'entries');
}
export type LeaderboardCursor = QueryDocumentSnapshot<DocumentData>;
export async function readLeaderboard(board: BoardId, cursor?: LeaderboardCursor) {
  const snapshot = await getDocsFromServer(query(entries(board), orderBy('score', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(PAGE_SIZE)));
  return { entries: snapshot.docs.map(item => ({ uid: item.id, ...item.data() } as LeaderboardEntry)), cursor: snapshot.docs.at(-1), hasMore: snapshot.size === PAGE_SIZE };
}
export async function readEntries(board: BoardId, uids: string[]): Promise<LeaderboardEntry[]> {
  const snapshots = await Promise.all([...new Set(uids)].map(uid => getDocFromServer(doc(entries(board), uid))));
  return snapshots.flatMap(item => item.exists() ? [{ uid: item.id, ...item.data() } as LeaderboardEntry] : []);
}
export async function readStanding(board: BoardId, score: number): Promise<Standing> {
  const ref = entries(board);
  const [total, ahead, below] = await Promise.all([
    getCountFromServer(query(ref, where('score', '>=', 0))),
    getCountFromServer(query(ref, where('score', '>', score))),
    getCountFromServer(query(ref, where('score', '<', score))),
  ]);
  return standingFromCounts(total.data().count, ahead.data().count, below.data().count);
}
