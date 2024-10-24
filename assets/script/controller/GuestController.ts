import { _decorator, animation, Component, instantiate, Node, Prefab, randomRange, randomRangeInt, SkeletalAnimation, v3, Vec3 } from 'cc';
import { Emoji } from '../library/ui/Emoji';
import { OrderMark } from '../library/ui/OrderMark';
import { Billboard } from '../library/ui/Billboard';
import { Item } from '../library/controller/Item';
import { Utils } from '../library/util/Utils';
import { ParabolaTween } from '../library/util/ParabolaTween';
const { ccclass, property } = _decorator;

@ccclass('GuestController')
export class GuestController extends Component {
    @property(Node)
    placePos:Node = null;
    
    @property(Emoji)
    emoji:Emoji = null;

    @property(OrderMark)
    order:OrderMark = null;

    @property
    orderType:number = 0;

    @property
    orderMin:number = 5;
    @property
    orderMax:number = 10;

    @property(Prefab)
    dollar:Prefab = null;

    @property
    speed:number = 5;

    @property
    angleSpeed:number = 450;

    @property(SkeletalAnimation)
    anim:SkeletalAnimation = null;

    public static State = {
        NONE:-1,
        MOVING:0,
        WAITING:1,
        BUYING:2,
        PAYING:3,
        TO_BACK:4,
    };

    protected static BACKWARD:Vec3 = v3(0, 0, 1);
    protected _tempPos:Vec3 = Vec3.ZERO.clone();
    protected _targetPos:Vec3 = Vec3.ZERO.clone();
    protected _velocity:Vec3 = Vec3.ZERO.clone();

    protected _state:number = GuestController.State.NONE;

    protected _moving:boolean = false;

    protected _buyTimer:number = 0;
    protected _orderCount:number = 0;
    protected _totalPrice:number = 0;
    protected static BUY_INTERVAL:number = 0.05;

    protected _waitTime:number = 0;
    protected _maxWaitTime:number = 0;
    protected static MAX_WAIT_TIME:number = 10;

    protected _paying:boolean = false;

    protected _inPath:Node = null;
    protected _outPath:Node = null;

    protected _pathIndex:number = 0;
    protected _pathSubIndex:number = 0;

    protected _targetPathIndex:number = 0;

    private _curAnimName:string = null;
    private _animationController: animation.AnimationController;

    public setup(cameraNode:Node, inPath:Node, outPath:Node, orderType:number) {
        if (this.order) {
            const billboard = this.order.getComponent(Billboard);
            if (billboard)
                billboard.cameraNode = cameraNode;
        }

        this._inPath = inPath;
        this._outPath = outPath;

        if (this._inPath)
            this.node.setPosition(this._inPath.children[0].getWorldPosition(this._tempPos));

        if (this.order) {
            this.order.node.active = false;
            this.orderType = orderType;
        }
    }

    public move2Index(inPathIndex:number) {
        this._targetPathIndex = inPathIndex;

        this._pathSubIndex = 0;

        this._state = GuestController.State.MOVING;

        if (this.getNextTargetPos(this._tempPos)) {
            this.moveTo(this._tempPos);
        }
    }

    public moveBack() {
        this._targetPathIndex = this._outPath.children.length - 1;

        this._pathIndex = 0;
        this._pathSubIndex = 0;

        this._state = GuestController.State.TO_BACK;

        if (this.getNextTargetPos(this._tempPos)) {
            this.moveTo(this._tempPos);
        }

        if (this.order)
            this.order.node.active = false;
    }

    public startBuy() {
        if (this.order)
            this.order.node.active = true;

        if (this.emoji)
            this.emoji.node.active = false;

        Utils.faceViewCommon(GuestController.BACKWARD, 100, this.node, this.angleSpeed);

        this.topAnimation(false);

        this._state = GuestController.State.BUYING;
    }

    public checkBuy() : boolean {
        if (this._state == GuestController.State.BUYING) {
            if (this._orderCount == 0) {
                if (this.emoji && this.emoji.getType() <= Emoji.TYPE.TIRED)
                    this.emoji.setType(Emoji.TYPE.SMILE);

                this._state = GuestController.State.PAYING;

                if (this.order)
                    this.order.node.active = false;
            } else
                return true;
        }

        return false;
    }

    public buyGood(node:Node) {
        if (this._orderCount > 0 && node) {
            const item = node.getComponent(Item);
            if (item) {
                this.setAnimationValue('Heavy', true);

                this._orderCount --;
                if (this.order)
                    this.order.setCount(this._orderCount);
    
                node.setScale(Vec3.ONE);
                Utils.calcArrangePos(null, item.getHalfDimension(), this.placePos.children.length, this._tempPos);
    
                this.placePos.addChild(node);
                ParabolaTween.moveNodeParabola(node, this._tempPos, 2, 0.5, -1, 0, false);
    
                this._totalPrice += item.price;

                this.topAnimation(false);
            }
        }
    }

    public checkPay(placePos:Node, placeDimen:Vec3) : boolean {
        if (this._state == GuestController.State.PAYING) {
            if (this._totalPrice > 0 && placePos) {
                const cash = instantiate(this.dollar);
                const item = cash.getComponent(Item);
                this._totalPrice -= item.price;

                if (this._totalPrice < 0)
                    this._totalPrice = 0;

                placePos.addChild(cash);

                this.node.getWorldPosition(this._tempPos);
                cash.setWorldPosition(this._tempPos);

                Utils.calcArrangePos(placeDimen, item.getHalfDimension(), placePos.children.length - 1, this._tempPos);

                ParabolaTween.moveNodeParabola(cash, this._tempPos, 4, 0.5, -1, 0/*720*/, placePos.children.length > 100, this.arrangeDollarCallback);

                return true;
            }
        }

        return false;
    }

    protected arrangeDollarCallback(node:Node, param:any) {
        if (node) {
            const item = node.getComponent(Item);
            item.scaleEffect(randomRange(0.2, 0.4));
        }
    }

    public isPaid() : boolean {
        return this._state == GuestController.State.PAYING && this._totalPrice <= 0;
    }

    start() {
        if (animation.AnimationController) {
            this._animationController = this.node.getComponent(animation.AnimationController);
            if (!this._animationController)
                this._animationController = this.getComponentInChildren(animation.AnimationController);
        }

        this.topAnimation(true);

        if (this.order)
            this.order.setType(this.orderType);

        this.initWork();
    }

    protected initWork() {
        this._buyTimer = 0;
        this._orderCount = randomRangeInt(this.orderMin, this.orderMax);
        if (this.order)
            this.order.setCount(this._orderCount);
        this._totalPrice = 0;
    
        this._waitTime = 0;
        if (this.emoji)
            this.emoji.setType(Emoji.TYPE.NONE);
        this._maxWaitTime = randomRange(GuestController.MAX_WAIT_TIME * 0.5, GuestController.MAX_WAIT_TIME);
    }

    protected moveTo(targetPos:Vec3) {
        this.topAnimation(true);

        this._targetPos.set(targetPos);
        this._targetPos.y = 0;

        this._moving = true;
    }

    public isArrived() : boolean {
        return this._state == GuestController.State.WAITING;
    }

    protected setAnimationName(newAnim:string) {
        if (this.anim && newAnim != this._curAnimName) {
            this.anim.play(newAnim);
            this._curAnimName = newAnim;
        }
    }

    protected topAnimation(start:boolean) {
        let name:string = start ? 'walk' : 'idle';
        if (this.placePos.children.length)
            name += 'Box';

        this.setAnimationValue('Speed', start ? this.speed : 0);
        this.setAnimationName(name);
    }

    protected setAnimationValue(tag:string, value:any){
        if (this._animationController)
            this._animationController.setValue(tag, value);
    }

    protected updateEmojiTime(deltaTime:number) {
        this._waitTime += deltaTime;

        const emojiType = Math.floor(this._waitTime * (Emoji.TYPE.ANGRY - Emoji.TYPE.TIRED + 1) / this._maxWaitTime);
        if (emojiType >= Emoji.TYPE.TIRED && this.emoji)
            this.emoji.setType(emojiType);
    }

    update(deltaTime: number) {
        if (this._moving) {
            this.node.getWorldPosition(this._tempPos);

            Vec3.subtract(this._velocity, this._targetPos, this._tempPos);
            const distance = this._velocity.lengthSqr();

            this._velocity.normalize();
            this._velocity.multiplyScalar(deltaTime * this.speed);
            this._tempPos.add(this._velocity);

            Utils.faceViewCommon(this._velocity, deltaTime, this.node, this.angleSpeed);                
            this.node.setWorldPosition(this._tempPos);

            if (this._velocity.length() >= distance) {
                if (this.getNextTargetPos(this._tempPos)) {
                    this.moveTo(this._tempPos);
                } else {
                    this.node.setWorldPosition(this._targetPos);
                    this._moving = false;
                }
            }
        }

        switch (this._state) {
            case GuestController.State.MOVING:
                if (!this._moving) {
                    this._state = GuestController.State.WAITING;
                    this.topAnimation(false);
                }
                break;
            case GuestController.State.TO_BACK:
                if (!this._moving) {
                    this.node.removeFromParent();
                    this.node.destroy();
                }
                break;
            case GuestController.State.WAITING:
                this.updateEmojiTime(deltaTime);
                break;
        }
    }

    protected getNextTargetPos(out:Vec3) : boolean {
        if (this._pathIndex == this._targetPathIndex)
            return false;

        const path = this._state == GuestController.State.TO_BACK ? this._outPath : this._inPath;
        if (0 <= this._pathIndex && this._pathIndex < path.children.length) {
            const pos = path.children[this._pathIndex];
            if (pos.children.length > 0 && this._pathSubIndex < pos.children.length) {
                pos.children[this._pathSubIndex ++].getWorldPosition(out);
                return true;
            } else
                this._pathSubIndex = 0;
            
            this._pathIndex ++;

            if (this._pathIndex < path.children.length) {
                path.children[this._pathIndex].getWorldPosition(out);
                return true;
            }
        }

        return false;
    }

}


