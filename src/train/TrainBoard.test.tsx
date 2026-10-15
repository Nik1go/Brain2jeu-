import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrainBoard } from './TrainBoard';
import { TrainExperience } from './TrainExperience';
import { advanceTrains, controllableJunction, newTrainGame, spawnTrain, toggleJunction } from './simulation';
import { emptyTrainProgress } from './storage';
import { TrainPlay } from './TrainPlay';
import { TRAIN_COLORS, TRAIN_RULES } from './config';
import { createTrainAudio } from './audio';
import { pathLength } from './network';

describe('interface Petit train', () => {
  it('expose de vrais boutons binaires et dessine les rails actifs sans flèches', () => {
    const game = newTrainGame(8);
    const html = renderToStaticMarkup(<TrainBoard game={game} onToggle={() => {}} />);
    expect(html.match(/class="junction-touch /g)).toHaveLength(10);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(10);
    expect(html.match(/class="rail rail-active"/g)).toHaveLength(10);
    expect(html).not.toContain('arrow');
    for (const station of game.network.stations) expect(html).toContain(`Gare ${station.color.name}, symbole ${station.color.symbol}`);
  });
  it('présente uniquement des niveaux, avec sept étapes verrouillées au début', () => {
    const html = renderToStaticMarkup(<TrainExperience progress={emptyTrainProgress()} onProgress={() => {}} onExit={() => {}} sound={false} reducedMotion={false} />);
    expect(html).not.toContain('Survie'); expect(html).not.toContain('Défi');
    expect(html.match(/verrouillé/g)).toHaveLength(7);
    expect(html).toContain('En voiture'); expect(html).toContain('4 gares'); expect(html).toContain('11 gares'); expect(html).toContain('150');
    expect(html).toContain('2 minutes');
  });
  it('affiche la pause et désactive les aiguillages du plateau en pause', () => {
    const html = renderToStaticMarkup(<TrainPlay level={3} previous={{}} onGenerated={() => {}} onFinish={() => {}} onQuit={() => {}} onRestart={() => {}} sound={false} audio={createTrainAudio()} reducedMotion={false} />);
    expect(html).toContain('Mettre la partie en pause');
    const game = { ...newTrainGame(8), paused: true };
    const paused = renderToStaticMarkup(<TrainBoard game={game} onToggle={() => {}} />);
    expect(paused.match(/disabled=""/g)).toHaveLength(10);
  });
  it('distingue les onze couleurs et garde les symboles lisibles sur leur fond', () => {
    const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const luminance = (hex: string) => rgb(hex).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((n, c, i) => n + c * [.2126, .7152, .0722][i], 0);
    for (const color of TRAIN_COLORS) {
      const a = luminance(color.color), b = luminance(color.ink);
      expect((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toBeGreaterThanOrEqual(4.5);
      for (const other of TRAIN_COLORS) if (other.id !== color.id) expect(Math.hypot(...rgb(color.color).map((c, i) => (c - rgb(other.color)[i]) * 255))).toBeGreaterThan(70);
    }
  });
  it('signale une mauvaise gare uniquement par une croix, sans message, halo ou secousse', () => {
    const base = newTrainGame(1), spawn = base.schedule[0];
    const station = base.network.stations.find(s => s.color.id !== spawn.colorId)!;
    const game = { ...base, elapsedMs: 1100, errors: 1, deliveries: [{ trainId: spawn.id, stationId: station.id, correct: false, atMs: 1000 }] };
    const html = renderToStaticMarkup(<TrainBoard game={game} onToggle={() => {}} />);
    expect(html).toContain('station-error-badge');
    for (const removed of ['Mauvaise gare', 'station-error-motion', 'station-error-ring', 'station-feedback-error', 'train-error-frame', 'train-failure-toast']) expect(html).not.toContain(removed);
    expect(html).not.toContain('disabled=""');
    const expired = renderToStaticMarkup(<TrainBoard game={{ ...game, elapsedMs: 1000 + TRAIN_RULES.failureFeedbackMs }} onToggle={() => {}} />);
    expect(expired).not.toContain('Mauvaise gare !'); expect(expired).not.toContain('station-error-badge');
  });
  it('ne montre pas de message d’erreur après une bonne arrivée', () => {
    const base = newTrainGame(1);
    const game = { ...base, elapsedMs: 1100, deliveries: [{ trainId: 0, stationId: 0, correct: true, atMs: 1000 }] };
    const html = renderToStaticMarkup(<TrainBoard game={game} onToggle={() => {}} />);
    expect(html).toContain('✓'); expect(html).not.toContain('Mauvaise gare !'); expect(html).not.toContain('station-error-motion');
  });
  it('éclaire le cercle exactement pendant la fenêtre où la locomotive peut changer de voie', () => {
    let seed = 6;
    const base = newTrainGame(3, { random: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } });
    const id = base.network.root.next.id, train = spawnTrain(base.network, { id: 0, colorId: 'blue', atMs: 0 });
    for (const offset of [-8, -6, 15, 42, 44]) {
      const game = advanceTrains({ ...base, schedule: [], trains: [{ ...train, distance: pathLength(base.network.root.pieces) + offset }] }, 1);
      const html = renderToStaticMarkup(<TrainBoard game={game} onToggle={() => {}} />);
      const active = controllableJunction(game.network, game.trains[0]) === id;
      expect(html.includes('junction-disc junction-occupied')).toBe(active);
      if (active) expect(html).toContain('train dans le cercle');
      else expect(html).not.toContain('train dans le cercle');
      expect(html).not.toContain('disabled=""');
      const switched = toggleJunction(game, id);
      if (offset === 15 || offset === 42) expect(switched.trains[0].pieces).not.toEqual(game.trains[0].pieces);
      if (offset === 44) expect(switched.trains[0].pieces).toEqual(game.trains[0].pieces);
    }
  });
});
