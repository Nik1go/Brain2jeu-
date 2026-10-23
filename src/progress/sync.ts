import { mergeProgress } from './model';
import type { PlayerProgress } from './model';

export type SyncStatus = 'local' | 'pending' | 'synced' | 'error';
export interface ProgressTransport {
  watch: (uid: string, next: (value: PlayerProgress) => void, error: (cause: unknown) => void) => () => void;
  merge: (uid: string, value: PlayerProgress) => Promise<PlayerProgress>;
}

// One instance per signed-in player. Ownership is captured, never read from a
// mutable "current user" after an async operation. Cache precedes every upload.
export class ProgressSync {
  private active = true;
  private running = false;
  private revision = 0;
  private stopWatch?: () => void;
  constructor(public value: PlayerProgress, private uid: string | undefined, private transport: ProgressTransport,
    private changed: (value: PlayerProgress) => void, private status: (value: SyncStatus) => void) {}

  start() { if (this.uid) { this.listen(); void this.flush(); } else this.status('local'); }
  private listen() {
    this.stopWatch?.();
    this.stopWatch = this.transport.watch(this.uid!, remote => {
      if (!this.active) return;
      const merged = mergeProgress(this.value, remote);
      if (JSON.stringify(merged) !== JSON.stringify(this.value)) { this.value = merged; this.changed(merged); }
    }, () => { if (this.active) this.status('error'); });
  }
  update(next: PlayerProgress) {
    if (!this.active) return;
    // A game can finish after a remote update: retain the remote achievements.
    this.value = mergeProgress(next, this.value);
    this.revision++;
    this.changed(this.value);
    if (this.uid) { this.status('pending'); void this.flush(); }
  }
  retry() { if (this.active && this.uid) { this.listen(); void this.flush(); } }
  private async flush() {
    if (!this.active || !this.uid || this.running) return;
    this.running = true;
    this.status('pending');
    try {
      let before: number;
      do {
        before = this.revision;
        const merged = await this.transport.merge(this.uid, this.value);
        if (!this.active) return;
        this.value = mergeProgress(this.value, merged);
        this.changed(this.value);
      } while (this.revision !== before);
      this.status('synced');
    } catch { if (this.active) this.status('error'); }
    finally { this.running = false; }
  }
  stop() { this.active = false; this.stopWatch?.(); }
}
