import { _decorator, CCString, Component, Enum, EPSILON, Node, ParticleSystem, Quat, randomRange, SkeletalAnimation, sys, Tween, tween, v3, Vec3 } from 'cc';
import { SoundMgr } from '../library/manager/SoundMgr';
import { AvatarController } from '../library/controller/AvatarController';
import { ItemType } from '../manager/ItemType';
import { AutoProgress3d } from './AutoProgress3d';
import { ProgressBubble } from './ProgressBubble';
import { Utils } from '../library/util/Utils';
const { ccclass, property } = _decorator;

enum State {
    FIELD=0,
    FIELD_PRODUCT=1,
    FOLLOW=2,
    PRODUCT_WAIT=3,
    PRODUCT_LIST=4,
    PRODUCTING=5,
    PRODUCT_HUNGRY=6,
    PRODUCT_END=7,
    FOLLOW_BACK=8,
};

@ccclass('AnimalController')
export class AnimalController extends AvatarController {
    public fieldHalfDimetion:Vec3 = null;
    public cameraNode:Node = null;

    @property({type: Enum(ItemType)})
    type:ItemType = ItemType.NONE;

    @property(Node)
    productIcon:Node = null;

    @property(ProgressBubble)
    productBubble:ProgressBubble = null;

    @property(Node)
    hungryIcon:Node = null;
    @property(ProgressBubble)
    hungryBubble:ProgressBubble = null;

    @property
    bubbleSpeed:number = 0.02;

    @property
    productTime:number = 2;

    @property
    productCount:number = 4;

    @property(CCString)
    productSfx:string = '';

    @property(CCString)
    productEmpySfx:string = '';

    @property
    idleSpeed:number = 0.1;

    @property
    idleMoveTime:number = 1;

    @property
    followWeight:number = 0.25;

    @property
    followDistance:number = 0.5;

    @property(SkeletalAnimation)
    anim:SkeletalAnimation = null;

    @property(ParticleSystem)
    followVfx:ParticleSystem = null;

    protected _fieldPos:Vec3 = null;
    protected _tempPos:Vec3 = Vec3.ZERO.clone();
    protected _productIconOrgPos:Vec3 = null;
    protected _productIconMovePos:Vec3 = null;

    protected _productTimer:number = 0;
    protected _productTime:number = 0;

    protected _moveTimer:number = 0;
    protected _moveInput:Vec3 = Vec3.ZERO.clone();

    protected _state:State = State.FIELD;
    protected _followNode:Node = null;

    protected _orgParent:Node = null;
    protected _prevPos:Vec3 = Vec3.ZERO.clone();

    protected _firstTime:boolean = true;

    protected _bubbleTimer:number = 0;

    public followMe(node:Node) : boolean {
        let ret:boolean = false;
        switch (this._state) {
            case State.FIELD_PRODUCT:
                if (this.productBubble) {
                    if (this._bubbleTimer == 0 || this._bubbleTimer + this.bubbleSpeed * 1000 < sys.now()) {
                        this._bubbleTimer = sys.now();
                        if (this.productBubble.addStep(true, 0.3)) {
                            ret = true;
                            this._state = State.FOLLOW;
                            this.showProduct(false);

                            this._bubbleTimer = 0;
                        }
                    }                    
                }
                break;
            case State.PRODUCT_END:
                ret = true;
                this._state = State.FOLLOW_BACK;
                break;
        }

        if (ret) {
            this._followNode = node;
            this.setAnimationName('walk');

            if (this.followVfx)
                this.followVfx.play();
        }

        return ret;
    }

    public unfollowMe(node:Node, checkOnly:boolean) : boolean {
        let ret:boolean = false;

        switch (this._state) {
            case State.FOLLOW:
            case State.FOLLOW_BACK:
                if (this._followNode == node) {
                    if (!checkOnly) {
                        this._followNode = null;
                    }
                    ret = true;
                }
                break;
        }

        return ret;
    }

    public isProductFollow() : boolean {
        return this._state == State.FOLLOW;
    }

    public isHungryFollow() : boolean {
        return this._state == State.FOLLOW_BACK;
    }

    public isField() : boolean {
        return this._state <= State.FIELD_PRODUCT;
    }

    public isNeedFood() : boolean {
        return State.PRODUCT_HUNGRY <= this._state  && this._state <= State.PRODUCT_END;
    }

    public isProducting() : boolean {
        return State.PRODUCT_LIST <= this._state  && this._state <= State.PRODUCTING;
    }

    start() {
        if (super.start)
            super.start();

        this._fieldPos = this.node.getPosition();

        if (this.fieldHalfDimetion) {
            this._tempPos.x = randomRange(-this.fieldHalfDimetion.x, this.fieldHalfDimetion.x);
            this._tempPos.z = randomRange(-this.fieldHalfDimetion.z, this.fieldHalfDimetion.z);
            this._tempPos.y = 0.2;

            this.node.setPosition(this._tempPos);
        }

        if (this.productIcon) {
            this._productIconOrgPos = this.productIcon.getPosition();
            this._productIconMovePos = this._productIconOrgPos.clone();
            this._productIconMovePos.y += 0.2;

            // this.productIcon.getComponent(Billboard).cameraNode = this.cameraNode;
        }

        this._orgParent = this.node.parent;

        this.initProduct();
    }

    protected initProduct() {
        this._productTime = randomRange(1, 1.5) * this.productTime;
        this._productTimer = this._firstTime ? this._productTime : 0;
        
        this._firstTime = false;
    }

    protected showProduct(show:boolean) {
        if (this.productIcon && this.productIcon.active != show) {
            Tween.stopAllByTarget(this.productIcon);

            if (show) {
                this.productBubble.showProgress(0);
                this.productIcon.setScale(Utils.Vec3Half);
                this.productIcon.setPosition(this._productIconOrgPos);
                this.productIcon.active = true;

                tween(this.productIcon)
                .to(0.5, {scale:Vec3.ONE})
                .call(() => {
                    tween(this.productIcon)
                    .to(0.5, {position:this._productIconMovePos})
                    .to(0.5, {position:this._productIconOrgPos})
                    .union()
                    .repeatForever()
                    .start();
                })
                .start();
            } else {
                // tween(this.productIcon)
                // .to(0.5, {scale:Vec3.ZERO})
                // .call(() => {
                    this.productIcon.active = false;
                // })
                // .start();
            }
        }
    }

    update(deltaTime: number) {
        switch (this._state) {
            case State.FIELD:
                if (this.hungryIcon && this.hungryIcon.active) {
                    this._bubbleTimer += deltaTime;
                    if (this._bubbleTimer >= this._productTime / this.hungryBubble.getTotalSteps()) {
                        this._bubbleTimer = 0;

                        if (this.hungryBubble.addStep(false)) {
                            this.hungryIcon.active = false;
                        }
                    }
                }
    
                this._productTimer += deltaTime;
                if (this._productTimer > this._productTime) {
                    this.hungryIcon.active = false;

                    if (this.productSfx.length)
                        SoundMgr.playSound(this.productSfx);

                    this._state = State.FIELD_PRODUCT;
                    this.showProduct(true);

                    this.setAnimationName('idle');
                } else {
                    this._moveTimer += deltaTime;
                    if (this._moveTimer > this.idleMoveTime) {
                        this._moveTimer = 0;
                        if (Vec3.equals(this._moveInput, Vec3.ZERO, EPSILON)) {
                            if (this.isInField()) {
                                this._moveInput.x = randomRange(-0.5, 0.5);
                                this._moveInput.z = randomRange(-0.5, 0.5);
                                this._moveInput.normalize();
                                this._moveInput.multiplyScalar(this.idleSpeed);
                            } else {
                                this.calcReturnInput(this._moveInput);
                            }
                        } else
                            this._moveInput.set(Vec3.ZERO);
                    }
                }
                break;
            case State.FIELD_PRODUCT:
                if (this.isInField())
                    this._moveInput.set(Vec3.ZERO);
                else
                    this.calcReturnInput(this._moveInput);
                break;
        
            case State.FOLLOW_BACK:
                if (this.isInField()) {
                    this._moveInput.set(Vec3.ZERO);
                    this._state = State.FIELD;
                    this._bubbleTimer = 0;
                    break;
                }
            case State.FOLLOW:
                if (this._followNode) {
                    this._followNode.getWorldPosition(this._moveInput);
                    this.node.getWorldPosition(this._tempPos);
                    this._moveInput.subtract(this._tempPos);
                    const distance = this._moveInput.length();
                    if (distance <= this.followDistance) {
                        this._moveInput.set(Vec3.ZERO);
                        // this.freeze(true);
                    } else {
                        // this.freeze(false);
                        this._moveInput.normalize();
                        if (distance > this.followDistance * 3) {
                            this._moveInput.normalize();
                            this._moveInput.multiplyScalar(Math.min(3, Math.exp(distance - this.followDistance)));
                            this._moveInput.x += randomRange(-1, 1);
                            this._moveInput.z += randomRange(-1, 1);
                        }
                    }
                }
                break;

            default:
                this._moveInput.set(Vec3.ZERO);
                break;
        }

        if (super.update)
            super.update(deltaTime);
    }

    protected lateUpdate(dt: number): void {
        if (super.lateUpdate)
            super.lateUpdate(dt);

        if (this.node.position.y < 0) {
            this.node.getPosition(this._tempPos);
            this._tempPos.y = 0;
            this.node.setPosition(this._tempPos);
        }
    }

    protected calcReturnInput(ioVec3:Vec3) {
        this.node.getPosition(this._moveInput);
        this._moveInput.multiplyScalar(-1);
        this._moveInput.normalize();

        if (this.node.position.z > this.fieldHalfDimetion.z) {
            this._moveInput.x += randomRange(-0.5, 0.5);
            this._moveInput.normalize();
            this._moveInput.multiplyScalar(Math.min(2, Math.exp(this.node.position.z - this.fieldHalfDimetion.z)));
        }
    }

    protected fetchMovementInput() : Vec3{
        return this._moveInput;
    }

    protected getTurnAngleSpeed() : number {
        return (this._state == State.FIELD ? this.idleSpeed : 1) * this.turnAngleSpeed;
    }

    protected isInField() : boolean {
        let ret:boolean = false;

        if (this.fieldHalfDimetion) {

            const curPos = this.node.position;
            ret = -this.fieldHalfDimetion.x <= curPos.x && curPos.x <= this.fieldHalfDimetion.x
                    && -this.fieldHalfDimetion.z <= curPos.z && curPos.z <= this.fieldHalfDimetion.z;
        }

        return ret;
    }

    public arrived(on:boolean) : boolean {
        let ret : boolean = false;

        if (on) {
            if (this._state == State.FOLLOW) {
                this._state = State.PRODUCT_WAIT;

                ret = true;
                this.setAnimationName('idle');
            }
        } else {
            if (this._state == State.PRODUCT_HUNGRY) {
                this._state = State.PRODUCT_END;

                this.node.setParent(this._orgParent);
                this._prevPos.x += randomRange(-0.5, 0.5);
                this._prevPos.z += randomRange(-0.5, 0.5);
                this._prevPos.y = 0.2;
                this.node.setWorldPosition(this._prevPos);

                this.freeze(false);
                // this.enablePhysics(true);

                this.initProduct();

                ret = true;
                this.setAnimationName('idle');
            }
        }

        return ret;
    }

    public showHungryIcon() {
        if (this.hungryIcon && !this.hungryIcon.active) {
            if (this._state == State.PRODUCTING)
                this._state = State.PRODUCT_HUNGRY;

            this.hungryBubble.showProgress(Infinity);
            this.hungryIcon.active = true;
            this.hungryIcon.setScale(Utils.Vec3Quater);

            tween(this.hungryIcon)
            .to(0.5, {scale:Vec3.ONE}, {easing:'bounceOut'})
            .start();
        
            if (this.productEmpySfx.length)
                SoundMgr.playSound(this.productEmpySfx);
        }
    }

    public onProductList(placePos:Node, returnPos:Node) : boolean {
        if (this._state == State.PRODUCT_WAIT) {
            this._state = State.PRODUCT_LIST;

            this.freeze(true);
            // this.enablePhysics(false);

            returnPos.getWorldPosition(this._prevPos);

            this.node.setParent(placePos);
            this.node.setPosition(Vec3.ZERO);
            this.node.setRotation(Quat.IDENTITY);

            this.scaleEffect(0.5);

            this.setAnimationName('idleSit');

            return true;
        }

        return false;
    }

    public onProducting() : boolean {
        if (this._state == State.PRODUCT_LIST) {
            this._state = State.PRODUCTING;

            return true;
        }

        return false;
    }

    public scaleEffect(period:number) {
        this.node.setScale(Vec3.ZERO);

        tween(this.node)
            .to(period, {scale:Vec3.ONE}, {easing:'bounceOut'})
            .start();
    }

    protected setAnimationName(name:string) {
        if (this.anim)
            this.anim.play(name);
    }
}


