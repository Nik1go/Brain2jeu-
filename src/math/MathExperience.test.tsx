import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MathAnswers, MathExperience, MathPlay, MathTutorial } from './MathExperience';
import { newMathGame } from './game';
import { emptyMathProgress } from './storage';

describe('interface Calcul mental', () => {
  it('propose trois niveaux accessibles avec leurs records', () => {
    const html = renderToStaticMarkup(<MathExperience progress={emptyMathProgress()} onProgress={() => {}} onExit={() => {}} sound={false} reducedMotion={false} />);
    expect(html).toContain('Niveau 1 · Petits nombres');
    expect(html).toContain('Niveau 2 · Grands calculs');
    expect(html).toContain('Niveau 3 · Finance');
    expect(html.match(/Record : /g)).toHaveLength(3);
    expect(html).not.toContain('disabled');
    expect(html).not.toContain('math-hud');
  });
  it('présente le tutoriel et un essai sans score', () => {
    const html = renderToStaticMarkup(<MathTutorial onDone={() => {}} onExit={() => {}} reducedMotion={false} />);
    expect(html).toContain('sans chrono ni points');
    expect(html).toContain('+2 s');
    expect(html).toContain('−5 s');
    expect(html).toContain('11 s max.');
    expect(html.match(/class="math-answer"/g)).toHaveLength(4);
    expect(html).not.toContain('math-hud');
  });
  it('garde une partie minimale et démarre la barre à 10/11', () => {
    const html = renderToStaticMarkup(<MathPlay onFinish={() => {}} sound={false} reducedMotion={false} />);
    expect(html).toContain('scaleX(0.9090909090909091)');
    expect(html.match(/class="math-answer"/g)).toHaveLength(4);
    expect(html).not.toContain('Niveau');
    expect(html).not.toContain('Valider');
    expect(html).not.toContain('is-correct');
    expect(html).not.toContain('is-wrong');
  });
  it('révèle la bonne réponse après une erreur, avec quatre boutons bloqués', () => {
    const game = newMathGame(0);
    const selected = game.question.choices.find(v => v !== game.question.answer)!;
    const html = renderToStaticMarkup(<MathAnswers question={game.question} onAnswer={() => {}} locked feedback={{ selected, correct: false, until: 200 }} />);
    expect(html.match(/disabled=""/g)).toHaveLength(4);
    expect(html.match(/class="math-answer is-correct"/g)).toHaveLength(1);
    expect(html.match(/class="math-answer is-wrong"/g)).toHaveLength(1);
  });
  it('permet de revoir le tutoriel après sa complétion', () => {
    const html = renderToStaticMarkup(<MathExperience progress={{ ...emptyMathProgress(), tutorialDone: true }} onProgress={() => {}} onExit={() => {}} sound={false} reducedMotion={false} initialTutorial />);
    expect(html).toContain('sans chrono ni points');
    const tutorial = renderToStaticMarkup(<MathTutorial onDone={() => {}} onExit={() => {}} reducedMotion />);
    expect(tutorial).toContain('reduce-motion');
  });
  it('explique les pourcentages dans l’essai Finance et affiche des réponses en euros', () => {
    const html = renderToStaticMarkup(<MathTutorial onDone={() => {}} onExit={() => {}} reducedMotion={false} level="finance" />);
    expect(html).toContain('20 % de 250 €');
    expect(html.match(/class="math-answer has-unit"/g)).toHaveLength(4);
    const game = renderToStaticMarkup(<MathPlay onFinish={() => {}} sound={false} reducedMotion={false} level="finance" />);
    expect(game).toContain('data-level="finance"');
    expect(game).toContain('€');
    expect(game).not.toContain('Niveau');
  });
});
