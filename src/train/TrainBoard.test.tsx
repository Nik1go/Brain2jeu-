import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrainBoard } from './TrainBoard';
import { TrainExperience } from './TrainExperience';
import { newTrainGame } from './simulation';
import { emptyTrainProgress } from './storage';
import { TrainPlay } from './TrainPlay';
import { TRAIN_COLORS, TRAIN_RULES } from './config';
import { createTrainAudio } from './audio';

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
  it('signale une mauvaise gare avec une croix, un halo et un message donnant la couleur attendue', () => {
    const base = newTrainGame(1), spawn = base.schedule[0];
    const station = base.network.stations.find(s => s.color.id !== spawn.colorId)!;
    const game = { ...base, elapsedMs: 1100, errors: 1, deliveries: [{ trainId: spawn.id, stationId: station.id, correct: false, atMs: 1000 }] };
    const html = renderToStaticMarkup(<TrainBoard game={game} onToggle={() => {}} />);
    expect(html).toContain('Mauvaise gare !'); expect(html).toContain(`la gare ${TRAIN_COLORS.find(c => c.id === spawn.colorId)!.name}`);
    expect(html).toContain('station-error-badge'); expect(html).toContain('station-error-motion'); expect(html).toContain('train-error-frame');
    expect(html).toContain('aria-live="polite"'); expect(html).not.toContain('disabled=""');
    const expired = renderToStaticMarkup(<TrainBoard game={{ ...game, elapsedMs: 1000 + TRAIN_RULES.failureFeedbackMs }} onToggle={() => {}} />);
    expect(expired).not.toContain('Mauvaise gare !'); expect(expired).not.toContain('station-error-badge');
  });
  it('ne montre pas de message d’erreur après une bonne arrivée', () => {
    const base = newTrainGame(1);
    const game = { ...base, elapsedMs: 1100, deliveries: [{ trainId: 0, stationId: 0, correct: true, atMs: 1000 }] };
    const html = renderToStaticMarkup(<TrainBoard game={game} onToggle={() => {}} />);
    expect(html).toContain('✓'); expect(html).not.toContain('Mauvaise gare !'); expect(html).not.toContain('station-error-motion');
  });
});
