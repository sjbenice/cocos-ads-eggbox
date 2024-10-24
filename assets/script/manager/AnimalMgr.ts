import { _decorator, Component, Enum, EPSILON, instantiate, Node, Prefab, Vec3 } from 'cc';
import { Utils } from '../library/util/Utils';
import { AnimalController } from '../controller/AnimalController';
import { GameState, GameStateMgr } from '../library/GameState';
const { ccclass, property } = _decorator;

@ccclass('AnimalMgr')
export class AnimalMgr extends Component {
    @property({ type: Enum(GameState) })
    gameState: GameState = GameState.NONE;

    @property(Node)
    placePos:Node = null;

    @property(Prefab)
    animalPrefab:Prefab = null;

    @property
    initialCount:number = 6;

    @property
    initInterval:number = 0.1;

    @property(Node)
    cameraNode:Node = null;

    protected _placeHalfDimension:Vec3 = null;
    protected _timer:number = 0;
    protected _initialCount:number = 0;
    
    protected onLoad(): void {
        if (this.placePos)
            this._placeHalfDimension = Utils.calcArrangeDimension(this.placePos);
    }

    protected start(): void {
        if (this.gameState > GameState.NONE)
            GameStateMgr.setState(this.gameState);
    }
    
    protected lateUpdate(dt: number): void {
        if (this.initialCount > this._initialCount) {
            this._timer += dt;
            if (this._timer > this.initInterval) {
                this._timer = 0;
                this._initialCount ++;
                if (this.animalPrefab && this._placeHalfDimension) {
                    const element = instantiate(this.animalPrefab);
                    this.placePos.addChild(element);
        
                    const animal = element.getComponent(AnimalController);
                    if (animal) {
                        animal.fieldHalfDimetion = this._placeHalfDimension;
                        animal.cameraNode = this.cameraNode;
                    }
                }
            }
        }
    }

    public cantTakeAnimal() : boolean {
        let count:number = 0;
        let weight:number = 0;
        
        this.placePos.children.forEach(node => {
            const animal = node.getComponent(AnimalController);
            if (animal && animal.isField()){
                count ++;
                weight = animal.followWeight;
            }
        })
        return (this.initialCount - count) * weight >= 1 - EPSILON;
    }
}


