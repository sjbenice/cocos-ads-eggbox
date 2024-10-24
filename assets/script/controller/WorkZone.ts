import { _decorator, CCString, Collider, Component, ITriggerEvent, MeshRenderer, Node, Quat, randomRange, sys, tween, Tween, Vec3 } from 'cc';
import { PlayerController } from './PlayerController';
import { Utils } from '../library/util/Utils';
import { ParabolaTween } from '../library/util/ParabolaTween';
import { SoundMgr } from '../library/manager/SoundMgr';
const { ccclass, property } = _decorator;

@ccclass('WorkZone')
export class WorkZone extends Component {
    @property
    workItemType:number = 0;

    @property(Node)
    outline:Node = null;

    @property
    dropInterval: number = 100; // Interval in milliseconds

    @property(Node)
    placePos:Node = null;

    @property
    placeParabola:boolean = false;
    
    @property(CCString)
    itemSound:string = '';

    @property(Node)
    assistant:Node = null;

    private _collider:Collider = null;

    private _dropTimers: number[] = [];
    private _isDropping:boolean = false;
    private _players:PlayerController[] = [];

    private _tempPos:Vec3 = Vec3.ZERO.clone();

    protected _outlineOrgScale:Vec3 = null;
    protected _outlineBlinkScale:Vec3 = null;
    protected _placeHalfDimention:Vec3 = null;

    protected _hasPlayer:boolean = true;// for first time blink outline

    start() {
        if (this.outline) {
            this._outlineOrgScale = this.outline.scale.clone();
            this._outlineBlinkScale = this._outlineOrgScale.clone();
            this._outlineBlinkScale.x *= 1.1;
            this._outlineBlinkScale.z *= 1.1;

            this.blinkOutline(true);
        }

        this._placeHalfDimention = Utils.calcArrangeDimension(this.placePos);

        this._collider = this.getComponent(Collider);

        if (this._collider) {
            this._collider.on('onTriggerEnter', this.onTriggerEnter, this);
            this._collider.on('onTriggerExit', this.onTriggerExit, this);
        }
    }
    
    onDestroy() {
        if (this._collider) {
            this._collider.off('onTriggerEnter', this.onTriggerEnter, this);
            this._collider.off('onTriggerExit', this.onTriggerExit, this);
        }
    }

    onTriggerEnter (event: ITriggerEvent) {
        const player:PlayerController = PlayerController.getGuestFromColliderEvent(event.otherCollider);
        if (player/* && player.hasItem(this.workItemType)*/){
            let index:number = 0;
            for (index = 0; index < this._players.length; index++) {
                if (this._players[index] == player) {
                    break;
                }
            }
            if (index >= this._players.length) {
                this._players.push(player);
                this._dropTimers.push(sys.now());
            }else
                this._dropTimers[index] = sys.now();
            
            this.blinkOutline(false);

            player.arrived(this.node, true);
        }
    }

    onTriggerExit (event: ITriggerEvent) {
        const player:PlayerController = PlayerController.getGuestFromColliderEvent(event.otherCollider);
        if (player){
            let hasPlayer:boolean = this.assistant && this.assistant.active;
            for (let index = 0; index < this._players.length; index++) {
                if (this._players[index] == player) {
                    this._dropTimers[index] = 0;
                    this._players[index] = null;
                }
                // if (this._dropTimers[index] != 0)
                //     hasPlayer = true;
                if (this._players[index])
                    hasPlayer = true;
            }

            if (!hasPlayer)
                this.blinkOutline(true);

            player.arrived(this.node, false);
        }
    }

    public hasPlayer() : boolean {
        return this._hasPlayer;
    }

    public hasGoods() : boolean {
        return this.placePos.children.length > 0;
    }
    
    public isSelling() : boolean {
        return this.hasPlayer() && this.hasGoods();
    }
    
    protected blinkOutline(blink:boolean) {
        if (this._hasPlayer == blink) {
            this._hasPlayer = !blink;

            if (this.outline) {
                Tween.stopAllByTarget(this.outline);

                if (blink) {
                    tween(this.outline)
                    .to(0.5, {scale:this._outlineBlinkScale})
                    .to(0.5, {scale:this._outlineOrgScale})
                    .union()
                    .repeatForever()
                    .start();
                }

                const mesh = this.outline.getComponent(MeshRenderer);
                if (mesh)
                    mesh.material = mesh.materials[blink ? 1 : 2];
            }
        }
    }

    public sellGood() : Node {
        if (this.placePos && this.placePos.children.length > 0 && !this._isDropping) {
            const node = this.placePos.children[this.placePos.children.length - 1];
            node.setScale(Vec3.ONE);

            return node;
        }

        return null;
    }

    update(deltaTime: number) {
        if (this.assistant && this.assistant.active)
            this.blinkOutline(false);
        
        this._isDropping = false;

        if (this._players.length > 0) {
            if (!this._players[this._players.length - 1]) {
                this._players.pop();
                this._dropTimers.pop();
            }
        }
        if (this._players.length > 0) {
            if (!this._players[0]) {
                this._players.shift();
                this._dropTimers.shift();
            }
        }

        for (let index = 0; index < this._dropTimers.length; index++) {
            if (this._players[index]) {
                const dropTimer = this._dropTimers[index];
                if (dropTimer > 0) {
                    this._isDropping = true;
                    if (sys.now() > dropTimer + this.dropInterval) {
                        const item = this._players[index].fetchItem();
                        
                        if (item && item.type == this.workItemType) {
                            this._dropTimers[index] = sys.now();
    
                            const element = item.node;
                            element.setScale(Vec3.ONE);
                            element.setRotation(Quat.IDENTITY);
                            element.getWorldPosition(this._tempPos);
                            element.setParent(this.placePos);
                            element.setWorldPosition(this._tempPos);
        
                            if (this._placeHalfDimention != null) {
                                Utils.calcArrangePos(this._placeHalfDimention, item.getHalfDimension(), 
                                    this.placePos.children.length - 1, this._tempPos);
        
                                if (this.placeParabola)
                                    ParabolaTween.moveNodeParabola(element, this._tempPos, 2, 0.5, -1, 0, false);
                                else {
                                    element.setPosition(this._tempPos);
                                    item.scaleEffect(randomRange(0.2, 0.4));
                                }
                            } else {
                                ParabolaTween.moveNodeParabola(element, Vec3.ZERO, 2, 0.5, 0.5);
                            }
        
                            if (this.itemSound.length)
                                SoundMgr.playSound(this.itemSound);
                        } else
                            this._dropTimers[index] = 0;
                    }            
                }
            }
        }
    }
}


