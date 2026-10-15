import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrainBoard } from './TrainBoard';
import { TrainExperience } from './TrainExperience';
import { newTrainGame } from './simulation';
import { emptyTrainProgress } from './storage';

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
});
