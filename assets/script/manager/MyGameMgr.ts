import { _decorator, Component, Node, Vec3 } from 'cc';
import { GameMgr } from '../library/manager/GameMgr';
import { PlayerController } from '../controller/PlayerController';
import { PayZone } from '../library/controller/PayZone';
import { WorkZone } from '../controller/WorkZone';
import { GameState, GameStateMgr } from '../library/GameState';
import { AnimalController } from '../controller/AnimalController';
import { AnimalWorkZone } from '../controller/AnimalWorkZone';
const { ccclass, property } = _decorator;

@ccclass('MyGameMgr')
export class MyGameMgr extends GameMgr {
    @property(PlayerController)
    player:PlayerController = null;

    @property(PayZone)
    payZones:PayZone[] = [];
    @property(WorkZone)
    workZones:WorkZone[] = [];

    @property(Node)
    moneyGroup:Node[] = [];

    @property(Node)
    inputGroup:Node[] = [];

    @property(Node)
    fieldPlace:Node = null;

    @property(Node)
    fieldPos:Node = null;

    @property(Node)
    factoryPos:Node = null;

    @property(Node)
    eggBoxTable:Node = null;
    
    @property(Node)
    finalNavigations:Node[] = [];

    @property(Node)
    packShotMgr:Node = null;

    protected _tutorTargetNodeHistory:Node[] = [];

    protected lateUpdate(dt: number): void {
        if (super.lateUpdate)
            super.lateUpdate(dt);

        if (this.player) {
            const state = GameStateMgr.getState();
            if (state >= GameState.MILK) {
                if (state == GameState.MILK) {
                    this.setTutorPos(this.finalNavigations[0], true, false);
                    this.scheduleOnce(()=>{
                        this.setTutorPos(this.finalNavigations[1], true, false);
                        if (this.packShotMgr) {
                            this.scheduleOnce(()=>{
                                this.packShotMgr.active = true;
                            }, 1);
                        }
                    }, 2);

                    GameStateMgr.setState(GameState.NAVIGATING);
                }
            } else {
                if (this.player.hasMoney()) {
                    for (let index = 0; index < this.payZones.length; index++) {
                        const element = this.payZones[index];
                        if (element && element.node.active) {
                            this.postTutorPos(element.node, true, true);
                            break;
                        }
                    }
                } else {
                    const item = this.player.fetchItem();
                    if (item) {
                        for (let index = 0; index < this.workZones.length; index++) {
                            const element = this.workZones[index];
                            if (element && element.node.active && element.workItemType == item.type) {
                                this.postTutorPos(element.node, true, true);
                                break;
                            }
                        }
                    } else {
                        if (this.player.hasProductAnimal(true))
                            this.postTutorPos(this.fieldPos, true, true);
                        else if (this.player.hasProductAnimal(false))
                            this.postTutorPos(this.factoryPos, false, true);
                        else if (this.moneyGroup.length && this.moneyGroup[0].children.length > 0 || (this.workZones[0].isSelling()))
                            this.postTutorPos(this.moneyGroup[0], false, true);
                        else if (this.workZones[0].hasGoods())
                            this.postTutorPos(this.workZones[0].node, false, false);
                        else if ((this.inputGroup.length && this.inputGroup[0].children.length > 0) || this.isProductingAnimal())
                            this.postTutorPos(this.inputGroup[0], false, true);
                        else if (this.isHungryAnimal() && this.eggBoxTable.children.length == 0)
                            this.postTutorPos(this.factoryPos, false, true);
                        else
                            this.postTutorPos(this.fieldPos, true, true);
                    }
                }
            }

            const tutorDirection = GameMgr.getTutorialDirection(this.player.node.getWorldPosition());
            this.player.adjustTutorArrow(tutorDirection, dt);
        }
    }

    protected postTutorPos(node:Node, followCamera:boolean, waitAction:boolean) {
        // this.unschedule(this.doSetTutorPos);
        // this.schedule(this.doSetTutorPos, 0, 1, 0.5);
        this.setTutorPos(node, followCamera, waitAction);
    }

    protected doSetTutorPos(node:Node, followCamera:boolean, waitAction:boolean) {

    }

    protected setTutorPos(node:Node, followCamera:boolean, waitAction:boolean) : Vec3 {
        const newPos = super.setTutorPos(node, followCamera, waitAction);
        
        if (followCamera && newPos && this.player && this._tutorTargetNodeHistory.indexOf(node) < 0) {
            if (waitAction && this._tutorTargetNodeHistory.length > 0) {
                this.scheduleOnce(()=>{
                    this.player.setTutorTargetPos(newPos, 0.5);
                }, 0.5)
            } else {
                this.scheduleOnce(()=>{
                    this.player.setTutorTargetPos(newPos, 0);
                }, 1)
            }
            this._tutorTargetNodeHistory.push(node);
        }

        return newPos;
    }

    protected isHungryAnimal() : boolean {
        let animals = this.fieldPlace.getComponentsInChildren(AnimalController);
        if (animals)
            for (let index = 0; index < animals.length; index++) {
                const animal = animals[index];
                if (animal && animal.isNeedFood())
                    return true;
            }

        const zone:AnimalWorkZone = this.factoryPos.getComponent(AnimalWorkZone);
        return zone.isAllHungry();
/*        animals = this.factoryPos.getComponentsInChildren(AnimalController);
        if (animals)
            for (let index = 0; index < animals.length; index++) {
                const animal = animals[index];
                if (animal && animal.isNeedFood())
                    return true;
            }

        return false;*/
    }

    protected isProductingAnimal() : boolean {
        const animals = this.factoryPos.getComponentsInChildren(AnimalController);
        if (animals)
            for (let index = 0; index < animals.length; index++) {
                const animal = animals[index];
                if (animal && animal.isProducting())
                    return true;
            }

        return false;
    }
}


