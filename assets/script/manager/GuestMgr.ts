import { _decorator, Collider, Component, instantiate, Node, Prefab, randomRangeInt, Vec3 } from 'cc';
import { WorkZone } from '../controller/WorkZone';
import { GuestController } from '../controller/GuestController';
import { ItemType } from './ItemType';
import event_html_playable from '../library/event_html_playable';
import { SoundMgr } from '../library/manager/SoundMgr';
const { ccclass, property } = _decorator;

@ccclass('GuestMgr')
export class GuestMgr extends Component {
    @property(Prefab)
    guestPrefabs:Prefab[] = [];

    @property(Node)
    group:Node = null;

    @property(Node)
    inPath:Node = null;

    @property(Node)
    outPath:Node = null;

    @property(Node)
    cameraNode:Node = null;

    @property(WorkZone)
    workZone:WorkZone = null;

    @property(Node)
    moneyPlace:Node = null;

    @property
    inteval:number = 0.5;

    @property
    buyInterval:number = 0.1;

    @property(Node)
    packshotMgr:Node = null;

    protected _guests:GuestController[] = [];

    protected _timer:number = 0;
    protected _buyTimer:number = 0;

    protected _moneyPlaceHafDimension:Vec3 = null;

    start() {
        if (this.inPath) {
            for (let index = 0; index < this.inPath.children.length; index++) {
                this._guests.push(null);
            }
        }

        if (this.moneyPlace)
            this._moneyPlaceHafDimension = this.moneyPlace.getComponent(Collider).worldBounds.halfExtents;
    }

    update(deltaTime: number) {
        this._buyTimer += deltaTime;
        if (this.workZone && this.workZone.hasPlayer() && this._buyTimer >= this.buyInterval) {
            this._buyTimer = 0;
            const firstGuest = this._guests[this._guests.length - 1];
            if (firstGuest) {
                if (firstGuest.checkPay(this.moneyPlace, this._moneyPlaceHafDimension)) {
                }
                if (firstGuest.checkBuy()) {
                    const good = this.workZone.sellGood();
                    if (good) {
                        firstGuest.buyGood(good);
                        SoundMgr.playSound('drop');
                    }
                }
            } 
        }

        this._timer += deltaTime;
        if (this._timer >= this.inteval) {
            this._timer = 0;

            const firstGuest = this._guests[this._guests.length - 1];
            if (firstGuest) {
                if (firstGuest.isArrived()) {
                    firstGuest.startBuy();
                } else if (firstGuest.isPaid()) {
                    SoundMgr.playSound('sell');
                    firstGuest.moveBack();
                    this._guests[this._guests.length - 1] = null;

                    if (this.packshotMgr && !this.packshotMgr.active && event_html_playable.version() == 2)
                        this.packshotMgr.active = true;
                }
            }

            for (let i = this._guests.length - 1; i > 0; i--) {
                const guest = this._guests[i];
                if (guest == null) {
                    let nextGuest:GuestController = null;
                    for (let j = i - 1; j > 0; j--) {
                        nextGuest = this._guests[j];
                        if (nextGuest) {
                            this._guests[j] = null;
                            break;
                        }
                    }

                    if (!nextGuest) {
                        nextGuest = instantiate(this.guestPrefabs[randomRangeInt(0, this.guestPrefabs.length)]).getComponent(GuestController);
                        this.group.addChild(nextGuest.node);
                        nextGuest.setup(this.cameraNode, this.inPath, this.outPath, ItemType.EGG4);
                    }

                    nextGuest.move2Index(i);

                    this._guests[i] = nextGuest;
                    break;
                }
            }
        }
    }
}



