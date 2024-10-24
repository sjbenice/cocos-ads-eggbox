import { _decorator, AudioSource, CCString, Collider, Color, Component, EPSILON, Graphics, ICollisionEvent, ITriggerEvent, lerp, MeshRenderer, Node, Quat, randomRange, randomRangeInt, RenderTexture, RigidBody, SpriteFrame, sys, tween, Tween, v3, Vec3 } from 'cc';
import { PHY_GROUP } from '../library/Layers';
import { AvatarController } from '../library/controller/AvatarController';
import { MoneyController } from '../library/ui/MoneyController';
import { CautionMark } from '../library/ui/CautionMark';
import { Utils } from '../library/util/Utils';
import { Item } from '../library/controller/Item';
import { SoundMgr } from '../library/manager/SoundMgr';
import { ParabolaTween } from '../library/util/ParabolaTween';
import { AnimalController } from './AnimalController';
import { AnimalMgr } from '../manager/AnimalMgr';
import { Number3d } from '../library/ui/Number3d';
const { ccclass, property } = _decorator;

@ccclass('PlayerController')
export class PlayerController extends AvatarController {
    @property(Node)
    tutorArrow:Node = null;

    @property(Node)
    placePos:Node = null;

    @property(Node)
    moneyPos:Node = null;

    @property(Node)
    topGroup:Node = null;
    @property
    topAnimationTime:number = 0.2;
    @property
    topAnimationY:number = 0.5;

    @property(MoneyController)
    money:MoneyController = null;

    @property(CCString)
    itemSound:string = '';

    @property(CautionMark)
    caution:CautionMark = null;

    @property
    botItemMax:number = 10;

    @property(Node)
    inputZone:Node = null;

    @property(Node)
    outputZone:Node = null;

    @property(AudioSource)
    audio:AudioSource = null;

    @property(Node)
    followMaxIcon:Node = null;

    @property(Node)
    sloganContainer:Node = null;
    @property(Node)
    sloganLabel:Node = null;

    @property(Node)
    showUiNodes:Node[] = [];

    @property(MeshRenderer)
    groundVfx:MeshRenderer = null;

    @property(RenderTexture)
    renderTexture:RenderTexture = null;

    @property(Graphics)
    renderGraphics:Graphics = null;

    @property(Node)
    assistant:Node = null;

    @property(Node)
    packshotMgr:Node = null;

    public static State = {
        NONE:-1,
        TO_IN:0,
        TO_OUT:1,
    };

    protected _state:number = PlayerController.State.NONE;
    
    protected _topAnimPos:Vec3 = Vec3.ZERO.clone();
    protected _tempPos:Vec3 = Vec3.ZERO.clone();
    protected _tempPos2:Vec3 = Vec3.ZERO.clone();

    protected _moving:boolean = false;
    protected _targetPos:Vec3 = Vec3.ZERO.clone();
    protected _velocity:Vec3 = Vec3.ZERO.clone();

    
    protected _sleepMoveTimer: number = 0;
    protected _sleepMoveInterval: number = 0;

    protected _rigidBody:RigidBody = null;

    protected placeHalfDimention:Vec3 = null;

    protected _moveInput:Vec3 = Vec3.ZERO.clone();
    protected _cameraTutorPos:Vec3 = Vec3.ZERO.clone();
    protected _cameraTutorWaitFlag:boolean = false;
    protected _cameraTutorWaitDelay:number = 0;
    protected _cameraTutorFlag:boolean = false;
    protected _cameraTutorReturnFlag:boolean = false;
    protected _cameraTutorTimer:number = 0;
    protected _cameraTutorSpeed:number = 0;

    protected _followWeight:number = 0;
    protected _followAnimals:AnimalController[] = [];

    protected _needUpdateRenderTexture:boolean = true;
    protected _renderTextureScale:Vec3 = Vec3.ONE.clone();

    start() {
        if (super.start)
            super.start();

        this._topAnimPos.y = this.topAnimationY;
        this.placeHalfDimention = Utils.calcArrangeDimension(this.placePos);

        this.topAnimation(true);

        if (this.isBot()) {
            this._state = PlayerController.State.TO_OUT;//.TO_IN;
        }

        this._moving = true;

        this.showSlogan(true);
        
        this.showUiNodes.forEach(node => {
            node.active = false;
        });
    }

    protected doCollisionEnter(event: ICollisionEvent){
        const guest = PlayerController.getGuestFromColliderEvent(event.otherCollider);
        if (guest) {
            this.onCollision(guest, true);
        }
    }

    public canFollowable() {
        return (!this.placePos || this.placePos.children.length == 0) && (!this.moneyPos || this.moneyPos.children.length == 0);
    }

    public canFollowed() {
        return this._followWeight < 1 && this.canFollowable();
    }
    
    protected registerFollowAnimal(animal:AnimalController) : boolean {
        if (animal) {
            if (this._followAnimals.indexOf(animal) < 0) {
                this._followAnimals.push(animal);
                this._followWeight += animal.followWeight;
                // console.log(this._followAnimals.length);

                if (this.itemSound.length)
                    SoundMgr.playSound(this.itemSound);

                return true;
            }
        }

        return false;
    }

    protected unregisterUnfollowAnimals() : boolean {
        let ret:boolean = this._followAnimals.length > 0;

        if (this._followAnimals.length > 0) {
            if (!this._followAnimals[this._followAnimals.length - 1])
                this._followAnimals.pop();
        }
        if (this._followAnimals.length > 0) {
            if (!this._followAnimals[0])
                this._followAnimals.shift();
        }

        for (let index = this._followAnimals.length - 1; index >= 0 ; index--) {
            const animal = this._followAnimals[index];
            if (animal && !animal.unfollowMe(this.node, true)) {
                this._followWeight -= animal.followWeight;

                this._followAnimals[index] = null;//???this._followAnimals.slice(index, index);
                if (this.itemSound.length)
                    SoundMgr.playSound(this.itemSound);
                // console.log('-', this._followWeight);
            }
        }

        return ret;
    }

    public fetchFollowAnimals() : AnimalController[] {
        return this._followAnimals;
    }
    
    protected doTriggerEnter(event: ITriggerEvent){
        if (event.otherCollider.getGroup() == PHY_GROUP.TRIGGER) {
            if (this.isBot() && 
                ((this._state == PlayerController.State.TO_IN && event.otherCollider.node == this.inputZone)
                 || (this._state == PlayerController.State.TO_OUT && event.otherCollider.node == this.outputZone))) {
                this._moving = false;
            }
        }

        this.onTrigger(event, true);
    }

    protected doTriggerStay(event: ITriggerEvent): void {
        this.onTrigger(event, false);
    }

    protected doTriggerExit(event: ITriggerEvent): void {
        if (event.otherCollider.getGroup() == PHY_GROUP.TRIGGER) {
            if (this.isBot() && !this._moving) {
                switch (this._state) {
                    case PlayerController.State.TO_IN:
                        this._moving = event.otherCollider.node == this.inputZone;
                        break;
                
                    case PlayerController.State.TO_OUT:
                        this._moving = event.otherCollider.node == this.outputZone;
                        break;
                }
            }
        }
    }

    public arrived(node:Node, enable:boolean) {
        if (this.isBot()) {
            switch (this._state) {
                case PlayerController.State.TO_IN:
                    if (node == this.inputZone)
                        this._moving = !enable;
                    break;
            
                case PlayerController.State.TO_OUT:
                    if (node == this.outputZone)
                        this._moving = !enable;
                    break;
            }
        }
    }

    public static getGuestFromColliderEvent(otherCollider:Collider) : PlayerController {
        if (otherCollider && otherCollider.getGroup() == PHY_GROUP.PLAYER) {
            const otherNode = otherCollider.node;
            if (otherNode) {
                const guest:PlayerController = otherNode.getComponent(PlayerController);
                return guest;
            }
        }

        return null;
    }

    protected getItemFromColliderEvent(otherCollider:Collider) : Item {
        if (otherCollider && otherCollider.getGroup() == PHY_GROUP.TRIGGER) {
            const otherNode = otherCollider.node;
            if (otherNode && otherNode.children.length > 0) {
                const item = otherNode.children[otherNode.children.length - 1].getComponent(Item);
                return item;
            }
        }

        return null;
    }

    protected onCollision(other:PlayerController, enter:boolean) {
        if (this.isBot() && !this.isSleeping()) {
            const baseTime = 2000 / this.baseSpeed;
            this.sleepMove(randomRangeInt(baseTime, baseTime * 1.5));

            // if (enter)
            //     SoundMgr.playSound('horn');
        }
    }

    protected showMaxIcon() {
        if (this.followMaxIcon && !this.followMaxIcon.active) {
            this.followMaxIcon.active = true;
            this.scheduleOnce(()=>{
                this.followMaxIcon.active = false;
            }, 2);
        }
    }

    protected onTrigger(event: ITriggerEvent, enter:boolean) {
        if (!this.isBot() && event.otherCollider && event.otherCollider.getGroup() == PHY_GROUP.ITEM) {
            const otherNode = event.otherCollider.node;
            if (otherNode && this.canFollowed()) {
                const animal = otherNode.getComponent(AnimalController);
                if (animal) {
                    if (animal.isField()) {
                        const animalMgr = animal.node.parent.parent.getComponent(AnimalMgr);
                        if (animalMgr && animalMgr.cantTakeAnimal()) {
                            this.showMaxIcon();
                            return;
                        }
                    }

                    if (animal.followMe(this.node)) {
                        this.registerFollowAnimal(animal);

                        if (!this.canFollowed()) {
                            this.showMaxIcon();
                        }
                        this.showSlogan(false);
                    }
                }
            }
        }

        if (this._followAnimals.length == 0) {
            const item = this.getItemFromColliderEvent(event.otherCollider);
            if (item) {
                if (item.type == 0 && this.isBot())
                    return;
    
                if (item.type == 0) {
                    if (this.placePos.children.length > 0)
                        return;
                } else {
                    if (this.moneyPos.children.length > 0)
                        return;
                }

                const placePos = item.type == 0 && this.moneyPos ? this.moneyPos : this.placePos;
    
                if (placePos) {
                    item.node.setScale(Vec3.ONE);
    
                    let rotateY:boolean = false;
                    let itemHalfDimen = item.getHalfDimension();
                    if (itemHalfDimen.z > itemHalfDimen.x) {
                        rotateY = true;
                        itemHalfDimen = itemHalfDimen.clone();
                        const temp = itemHalfDimen.x;
                        itemHalfDimen.x = itemHalfDimen.z;
                        itemHalfDimen.z = temp;
                    }
    
                    if (placePos.children.length == 0 || placePos.children[0].getComponent(Item).type == item.type) {
                        const caution = !Utils.calcArrangePos(this.placeHalfDimention, itemHalfDimen, placePos.children.length, this._tempPos);
                        if (caution || (this.isBot() && placePos.children.length >= this.botItemMax)) {
                            if (this.isBot() && this.outputZone) {
                                this._state = PlayerController.State.TO_OUT;
                                this._moving = true;
                                // this.moveTo(this.outputZone.getWorldPosition(this._tempPos));
                            }
    
                            if (this.caution)
                                this.caution.showCaution(true, 1);
                        } else {
                            item.node.setParent(placePos);
                            item.node.setPosition(this._tempPos);
        
                            item.enablePhysics(false);
                            if (rotateY)
                                item.node.setRotationFromEuler(v3(0, 90, 0));
    
                            item.scaleEffect(randomRange(0.2, 0.4));
        
                            if (item.type == 0 && this.money)
                                this.money.addMoney(item.price);
                            else if (this.itemSound.length > 0)
                                SoundMgr.playSound(this.itemSound);
                        }
                    }
                }
            }
        }
    }

    protected sleepMove(sleepMilliseconds:number):void {
        this._sleepMoveTimer = sys.now();
        this._sleepMoveInterval = sleepMilliseconds;
    }

    protected isSleeping() : boolean {
        if (this._sleepMoveTimer > 0) {
            if (sys.now() >= this._sleepMoveTimer + this._sleepMoveInterval) {
                this._sleepMoveTimer = 0;
            }
        }

        return this._sleepMoveTimer > 0;
    }
    
    protected canMove(movementInput:Vec3) : boolean {
        let ret = super.canMove(movementInput);
        if (ret) {
            if (this.assistant && this.assistant.active) {
                ret = false;
                if (this.packshotMgr)
                    this.packshotMgr.active = true;
            } else if (this._cameraTutorWaitFlag && this._cameraTutorWaitDelay > 0) {
                this.scheduleOnce(()=>{
                    this._cameraTutorWaitFlag = false;
                    this._cameraTutorFlag = true;
                }, this._cameraTutorWaitDelay);

                this._cameraTutorWaitDelay = 0;
            } else if (!this._cameraTutorFlag && !this._cameraTutorWaitFlag && !this._cameraTutorReturnFlag) {
                ret = this._moving;

                if (this._sleepMoveTimer > 0){
                    if (sys.now() < this._sleepMoveTimer + this._sleepMoveInterval)
                        ret = false;
                    else
                        this._sleepMoveTimer = 0;
                }
            } else
                ret = false;
        }

        return ret;
    }

    public adjustTutorArrow(tutorialDirection:Vec3, deltaTime:number) {
        if (this.tutorArrow) {
            if (tutorialDirection) {
                this.tutorArrow.active = true;
                if (!Vec3.equals(tutorialDirection, Vec3.ZERO)) {
                    this.faceView(tutorialDirection, deltaTime, this.tutorArrow, 0);
                }
            } else
                this.tutorArrow.active = false;
        }
    }

    public setTutorTargetPos(pos:Vec3, delay:number) {
        this._cameraTutorPos.set(pos);

        this._cameraTutorWaitFlag = true;
        this._cameraTutorFlag = false;
        this._cameraTutorReturnFlag = false;

        this._cameraTutorWaitDelay = delay;
        if (delay == 0) {
            this._cameraTutorWaitFlag = false;
            this._cameraTutorFlag = true;
        }

        this._cameraTutorTimer = 0;

        this.node.getWorldPosition(this._tempPos);
        this._tempPos.subtract(this._cameraTutorPos);
        this._cameraTutorSpeed = this._tempPos.length();// / 50;
    }

    protected getCameraFollowPosition(out:Vec3) {
        if (this._cameraTutorFlag) {
            out.set(this._cameraTutorPos);

            return;
        }

        return super.getCameraFollowPosition(out);
    }
    
    protected adjustCameraPosition(deltaTime:number) : boolean {
        const ret = super.adjustCameraPosition(deltaTime);

        if (this._cameraTutorReturnFlag) {
            if (ret)
                this._cameraTutorReturnFlag = false;
        }
        
        if (this._cameraTutorFlag) {
            if (ret) {
                this._cameraTutorTimer += deltaTime;
                if (this._cameraTutorTimer > 1) {
                    this._cameraTutorFlag = false;
                    this._cameraTutorReturnFlag = true;
                }
            }
        }

        return ret;
    }

    protected calcNextCameraFollowPosition(ioCur:Vec3, dest:Vec3, deltaTime:number) {
        const cameraFollowSpeed = (this._cameraTutorSpeed > 0 ? this._cameraTutorSpeed : 5) * deltaTime;
        // if (this._cameraTutorFlag) {
            this._tempPos.set(dest);
            this._tempPos.subtract(ioCur);
            if (this._tempPos.length() <= cameraFollowSpeed) {
                ioCur.set(dest);
            } else {
                this._tempPos.normalize();
                this._tempPos.multiplyScalar(cameraFollowSpeed);
                ioCur.add(this._tempPos);
            }
        // } else
        //     super.calcNextCameraFollowPosition(ioCur, dest);
    }

    // protected moveTo(targetPos:Vec3) {
    //     this.topAnimation(true);

    //     this._targetPos.set(targetPos);
    //     this._targetPos.y = 0;

    //     this._moving = true;
    // }

    protected topAnimation(start:boolean) {
        if (this.topGroup) {
            Tween.stopAllByTarget(this.topGroup);
            this.topGroup.setPosition(Vec3.ZERO);
    
            if (start)
                tween(this.topGroup)
                .to(this.topAnimationTime, {position:this._topAnimPos})
                .to(this.topAnimationTime, {position:Vec3.ZERO})
                .union()
                .repeatForever()
                .start();
        }
    }

    public getMoney() :number {
        return this.money.getMoney();
    }

    public hasItem(type:number) : boolean {
        if (this.placePos && this.placePos.children.length) {
            const firstItem = this.placePos.children[0].getComponent(Item);
            return (firstItem && firstItem.type == type);
        }

        return false;
    }

    public fetchItem() : Item {
        if (this.placePos && this.placePos.children.length) {
            const item = this.placePos.children[this.placePos.children.length - 1].getComponent(Item);
            return item;
        }

        return null;
    }

    public hasProductAnimal(hungry:boolean) : boolean {
        for (let index = 0; index < this._followAnimals.length; index++) {
            const animal = this._followAnimals[index];
            if (animal && 
                ((hungry && animal.isHungryFollow()) || (!hungry && animal.isProductFollow())))
                return true;
        }

        return false;
    }

    public hasMoney() : boolean {
        if (this.moneyPos)
            return this.moneyPos.children.length > 0;

        const item = this.fetchItem();
        return (item && item.type == 0);
    }

    public payOnce(target:Node) : number {
        const placePos = this.moneyPos ? this.moneyPos : this.placePos;

        if (target && placePos && placePos.children.length) {
            const firstItem = placePos.children[0].getComponent(Item);
            if (firstItem && firstItem.type == 0) {
                const unit = placePos.children[0].getComponent(Item).price;
                if (this.money)
                    this.money.addMoney(-unit);

                const element = placePos.children[placePos.children.length - 1];
                element.getWorldPosition(this._tempPos);
                element.setParent(target.parent);// ??? target
                element.setWorldPosition(this._tempPos);
                ParabolaTween.moveNodeParabola(element, Vec3.ZERO, 4, 0.5, -1, 360);

                if (this.itemSound.length)
                    SoundMgr.playSound(this.itemSound);

                return unit;
            }
        }

        return 0;
    }

    protected calcMoveInput(endPos:Vec3){
        if (endPos){
            this._moveInput.set(endPos);
            this._moveInput.subtract(this.node.position);
            this._moveInput.normalize();
        }else{
            this._moveInput.set(Vec3.ZERO);
        }

        return this._moveInput;
    }

    protected fetchMovementInput() : Vec3{
        return this.isBot() ? this._moveInput : super.fetchMovementInput();
    }

    update(deltaTime: number) {
        if (this.isBot()) {
            this._moveInput.set(Vec3.ZERO);

            switch (this._state) {
                case PlayerController.State.TO_IN:
                    this.calcMoveInput(this.inputZone.getWorldPosition(this._tempPos));
                    break;
                case PlayerController.State.TO_OUT:
                    if (this.placePos && this.placePos.children.length == 0 && this.inputZone) {
                        this._state = PlayerController.State.TO_IN;
                        this._moving = true;
                    } else
                        this.calcMoveInput(this.outputZone.getWorldPosition(this._tempPos));
                    break;
            }
        } else {
            if (this._followAnimals.length > 0 || this._needUpdateRenderTexture)
                this.drawRenderGraphics();
        }

        super.update(deltaTime);
    }

    protected adjustStatus() {
        this.setAnimationValue('Heavy', this.placePos.children.length > 0);
    }
    
    protected setAnimationSpeed(speed:number){
        super.setAnimationSpeed(speed);

        if (this.audio) {
            if (speed == 0 || SoundMgr.getPref(false) == 0) {
                if (this.audio.playing)
                    this.audio.stop();
            } else {
                if (!this.audio.playing)
                    this.audio.play();
            }
        }
    }

    protected lateUpdate(dt: number): void {
        if (super.lateUpdate)
            super.lateUpdate(dt);

        if (!this.isBot()) {
            this.unregisterUnfollowAnimals();
        }
        this.adjustStatus();
        // this.updateGroundVfx();
    }

    protected showSlogan(show:boolean) {
        if (this.sloganContainer && this.sloganContainer.active != show) {
            this.sloganContainer.active = show;
    
            if (this.sloganLabel) {
                if (show) {
                    tween(this.sloganLabel)
                    .to(0.5, {scale:v3(1.1, 1.1, 1)})
                    .to(0.5, {scale:Vec3.ONE})
                    .union()
                    .repeatForever()
                    .start();
                } else {
                    Tween.stopAllByTarget(this.sloganLabel)
                }
            }

            if (!show)
                this.showUiNodes.forEach(node => {
                    node.active = true;
                });
        }
    }

    public drawRenderGraphics() {
        if (this.renderGraphics) {
            this.renderGraphics.clear();

            const radius:number = 0.65;
            const zoomRadius:number = 256;
            this.node.getWorldPosition(this._tempPos);
            const limitDistance:number = this.groundVfx.node.scale.x / 2 - radius;
/*            
            let maxDistance: number = 0;
            this._followAnimals.forEach(animal => {
                if (animal) {
                    animal.node.getWorldPosition(this._tempPos2);
                    this._tempPos2.subtract(this._tempPos);

                    const distance = this._tempPos2.length();
                    if (distance > maxDistance && distance < limitDistance)
                        maxDistance = distance;
                }
            });
            maxDistance += radius;

            // this._renderTextureScale.set(Vec3.ONE);
            this._renderTextureScale.x = maxDistance * 2;
            this._renderTextureScale.y = maxDistance * 2;
            // this.groundVfx.node.setScale(this._renderTextureScale);
*/

            let drawScale:number = zoomRadius / (this.groundVfx.node.scale.x / 2);//maxDistance;
            const circleRadius:number = drawScale * radius;
            const inRadius:number = circleRadius * 0.9;

            this.renderGraphics.fillColor = Color.WHITE;
            this.renderGraphics.circle(0, 0, circleRadius);

            this._followAnimals.forEach(animal => {
                if (animal) {
                    animal.node.getWorldPosition(this._tempPos2);
                    this._tempPos2.subtract(this._tempPos);
                    const distance = this._tempPos2.length();
                    if (distance < limitDistance) {
                        this._tempPos2.multiplyScalar(drawScale);
                        this.renderGraphics.circle(this._tempPos2.x, this._tempPos2.z, circleRadius);
                    }
                }
            });

            this.renderGraphics.fill();

            this.renderGraphics.fillColor = Color.BLACK;
            this.renderGraphics.circle(0, 0, inRadius);

            this._followAnimals.forEach(animal => {
                if (animal) {
                    animal.node.getWorldPosition(this._tempPos2);
                    this._tempPos2.subtract(this._tempPos);
                    const distance = this._tempPos2.length();
                    if (distance < limitDistance) {
                        this._tempPos2.multiplyScalar(drawScale);
                        this.renderGraphics.circle(this._tempPos2.x, this._tempPos2.z, inRadius);
                    }
                }
            });

            this.renderGraphics.fill();

            this._needUpdateRenderTexture = false;

            this.groundVfx.node.setWorldRotationFromEuler(-90, 0, 0);
        }
    }
/*
    protected updateGroundVfx() {
        if (this.renderTexture && this._needUpdateRenderTexture) {
            this._needUpdateRenderTexture = false;

            // this.groundVfx.material.setProperty('mainTexture', this.renderTexture.getGFXTexture());

            this.groundVfx.node.setScale(this._renderTextureScale);
            this.groundVfx.node.setWorldRotationFromEuler(-90, 0, 0);
        }
    }*/
}
