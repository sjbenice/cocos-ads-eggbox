import { _decorator, Collider, Component, Enum, instantiate, ITriggerEvent, MeshRenderer, Node, Prefab, Quat, randomRange, sys, tween, Tween, Vec3 } from 'cc';
import { ItemType } from '../manager/ItemType';
import { AnimalController } from './AnimalController';
import { PHY_GROUP } from '../library/Layers';
import { ParabolaTween } from '../library/util/ParabolaTween';
import { Utils } from '../library/util/Utils';
import { Item } from '../library/controller/Item';
import { PlayerController } from './PlayerController';
import { Number3d } from '../library/ui/Number3d';
const { ccclass, property } = _decorator;

@ccclass('AnimalWorkZone')
export class AnimalWorkZone extends Component {
    @property({type:Enum(ItemType)})
    workItemType:ItemType = ItemType.NONE;

    @property(Node)
    outline:Node = null;

    @property(Node)
    placePos:Node = null;
    
    @property(Node)
    progressGroup:Node = null;

    @property(Prefab)
    productPrefab:Prefab = null;

    @property
    productTime:number = 0.2;

    @property
    lineTime: number = 0.5;

    @property(Node)
    lineGroup:Node = null;

    @property(Node)
    outputPos:Node = null;

    @property(Number3d)
    count3d:Number3d = null;

    private _collider:Collider = null;

    private _animals:AnimalController[] = [];

    private _tempPos:Vec3 = Vec3.ZERO.clone();

    protected _outlineOrgScale:Vec3 = null;
    protected _outlineBlinkScale:Vec3 = null;

    protected _productCount:number = 0;
    protected _productTimer:number = 0;
    protected _outputHalfDimension:Vec3 = null;
    protected _lineEndPos:Vec3 = null;

    protected _isBlinking:boolean = false;

    protected _hasPlayer:boolean = true;

    protected _curChickens:number = 0;

    start() {
        if (this.outline) {
            this._outlineOrgScale = this.outline.scale.clone();
            this._outlineBlinkScale = this._outlineOrgScale.clone();
            this._outlineBlinkScale.x *= 1.1;
            this._outlineBlinkScale.z *= 1.1;

            this.blinkOutline(true);
        }

        this.updateCurChickenCount();

        if (this.outputPos)
            this._outputHalfDimension = Utils.calcArrangeDimension(this.outputPos);

        if (this.lineGroup)
            this._lineEndPos = this.lineGroup.children[1].getWorldPosition();

        this._collider = this.getComponent(Collider);

        if (this._collider) {
            this._collider.on('onTriggerEnter', this.onTriggerEnter, this);
            // this._collider.on('onTriggerStay', this.onTriggerStay, this);
            this._collider.on('onTriggerExit', this.onTriggerExit, this);
        }
    }
    
    onDestroy() {
        if (this._collider) {
            this._collider.off('onTriggerEnter', this.onTriggerEnter, this);
            // this._collider.off('onTriggerStay', this.onTriggerStay, this);
            this._collider.off('onTriggerExit', this.onTriggerExit, this);
        }
    }

    onTriggerEnter (event: ITriggerEvent) {
        this.onTrigger(event, true);
    }

    // onTriggerStay (event: ITriggerEvent) {
    //     this.onTrigger(event, false);
    // }

    onTrigger(event: ITriggerEvent, enter:boolean) {
        // if (event.otherCollider && event.otherCollider.getGroup() == PHY_GROUP.ITEM) {
        //     const otherNode = event.otherCollider.node;
        //     if (otherNode) {
        //         const animal:AnimalController = otherNode.getComponent(AnimalController);
        //         if (animal && animal.type == this.workItemType) {
        //             if (this._animals.indexOf(animal) < 0) {
        //                 if (animal.arrived(true)) {
        //                     this._animals.push(animal);

        //                     this.blinkOutline(false);
        //                 }
        //             }
        //         }
        //     }
        // }

        if (event.otherCollider && event.otherCollider.getGroup() == PHY_GROUP.PLAYER) {
            const otherNode = event.otherCollider.node;
            if (otherNode) {
                const player:PlayerController = otherNode.getComponent(PlayerController);
                if (player) {
                    const animals:AnimalController[] = player.fetchFollowAnimals();
                    animals.forEach(animal => {
                        if (animal && animal.type == this.workItemType) {
                            if (this._animals.indexOf(animal) < 0) {
                                if (animal.arrived(true)) {
                                    this._animals.push(animal);
                                }
                            }
                        }
                    })
                    
                    this._hasPlayer = player.canFollowable();//.canFollowed();
                    this.blinkOutline(false);
                }
            }
        }
    }

    onTriggerExit (event: ITriggerEvent) {
        // if (this._animals.length == 0)
        //     this.blinkOutline(true);

        if (event.otherCollider && event.otherCollider.getGroup() == PHY_GROUP.PLAYER) {
            this._hasPlayer = false;
            this.blinkOutline(true);
        }
    }
    
    protected blinkOutline(blink:boolean) {
        if (this.outline && this._isBlinking != blink) {
            this._isBlinking = blink;

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

    protected lateUpdate(dt: number): void {
        if (this._animals.length > 0) {
            for (let index = 0; index < this.placePos.children.length; index++) {
                const place = this.placePos.children[index];
                if (place && place.children.length == 0) {
                    const animal = this._animals.shift();
                    if (animal && animal.onProductList(place, this.node)) {
                        this._curChickens ++;
                        this.updateCurChickenCount();
                    }

                    if (this.progressGroup)
                        this.progressGroup.children[index].active = true;

                    break;
                }
            }
        }
        // else
        //     this.blinkOutline(true);

        if (this._productCount > 0 && this.productPrefab) {
            this._productTimer += dt;
            if (this._productTimer >= this.productTime) {
                this._productTimer = 0;
                this._productCount --;

                const product = instantiate(this.productPrefab);
                this.node.addChild(product);
                this.lineGroup.children[0].getWorldPosition(this._tempPos);
                product.setWorldPosition(this._tempPos);

                tween(product)
                .to(this.lineTime, {worldPosition:this._lineEndPos})
                .call(()=>{
                    product.setParent(this.outputPos);
                    const item = product.getComponent(Item);
                    if (Utils.calcArrangePos(this._outputHalfDimension, item.getHalfDimension(), this.outputPos.children.length - 1, this._tempPos)) {
                        product.setPosition(this._tempPos);
                        item.scaleEffect(randomRange(0.2, 0.4));
                    } else {
                        product.removeFromParent();
                        product.destroy();
                    }
                })
                .start();
            }
        }

        const animals = this.placePos.getComponentsInChildren(AnimalController);
        const fullHungry = this.isAllHungry(animals);

        if (animals) {
            for (let index = 0; index < animals.length; index++) {
                const animal = animals[index];
                if (animal) {
                    if (this._productCount == 0) {
                        if (animal.onProducting()) {
                            this._productCount += animal.productCount;
                            this.scheduleOnce(()=>{
                                animal.showHungryIcon();
                            }, 3);
                            break;
                        }

                        if (this._hasPlayer && this.outputPos.children.length == 0 && fullHungry) {
                            if (animal.arrived(false)) {
                                this._curChickens --;
                                this.updateCurChickenCount();
                            }
                        }
                    }
                }
            }
        }
    }

    public isAllHungry(animals:AnimalController[] = null) : boolean {
        let count:number = this.placePos.children.length;
        if (!animals)
            animals = this.placePos.getComponentsInChildren(AnimalController);

        animals.forEach(animal => {
            if (animal.isNeedFood())
                count --;
        });
        
        return count == 0;
    }

    protected updateCurChickenCount() {
        if (this.count3d)
            this.count3d.setValue(this._curChickens);
    }
    
}



