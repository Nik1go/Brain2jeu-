import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyProgress, loadProgress, saveProgress, STORAGE_KEY } from './storage';

afterEach(()=>vi.unstubAllGlobals());
function mockStored(value:unknown){const data=new Map([[STORAGE_KEY,JSON.stringify(value)]]);vi.stubGlobal('localStorage',{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)});}
describe('migration des niveaux de miroirs',()=>{
 it.each([[1,1],[2,1],[3,2],[18,17]])('décale le niveau débloqué %s vers %s une seule fois',(oldLevel,newLevel)=>{
   mockStored({...emptyProgress(),progressionVersion:undefined,unlocked:oldLevel});
   const migrated=loadProgress();expect(migrated.unlocked).toBe(newLevel);
   saveProgress(migrated);expect(loadProgress().unlocked).toBe(newLevel);
 });
 it('garde le tutoriel, l’historique et les anciens records dans leur progression d’origine',()=>{
   const history=[{date:'2026-10-15T10:00:00Z',mode:'survival',level:4,score:900,correct:6,answers:9,responseTotalMs:7000}];
   mockStored({...emptyProgress(),progressionVersion:undefined,unlocked:4,tutorialDone:true,survivalBest:900,challengeBest:{'1':450,'3':800},history});
   const migrated=loadProgress();expect(migrated.unlocked).toBe(3);expect(migrated.tutorialDone).toBe(true);
   expect(migrated.previousLevelRecords).toEqual({survivalBest:900,challengeBest:{'1':450,'3':800}});
   expect(migrated.survivalBest).toBe(null);expect(migrated.challengeBest).toEqual({});
   expect(migrated.history[0].level).toBe(4);expect(migrated.history[0].progressionVersion).toBe(1);
   saveProgress(migrated);expect(loadProgress().previousLevelRecords).toEqual(migrated.previousLevelRecords);
 });
});
