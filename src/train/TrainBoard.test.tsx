import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrainBoard } from './TrainBoard';
import { TrainExperience } from './TrainExperience';
import { newTrainGame } from './simulation';
import { emptyTrainProgress } from './storage';
import { TrainPlay } from './TrainPlay';
import { TRAIN_COLORS } from './config';

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
    const html = renderToStaticMarkup(<TrainPlay level={3} previous={{}} onGenerated={() => {}} onFinish={() => {}} onQuit={() => {}} sound={false} reducedMotion={false} />);
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
});
