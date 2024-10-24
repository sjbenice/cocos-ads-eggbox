import { _decorator, Component, Node, Vec3 } from 'cc';
import { Billboard } from '../library/ui/Billboard';
const { ccclass, property } = _decorator;

@ccclass('AutoProgress3d')
export class AutoProgress3d extends Component {
    @property(Node)
    bar:Node = null;

    @property
    time:number = 1;

    protected _timer:number = 0;
    protected _tempPos:Vec3 = Vec3.ONE.clone();

    start() {
        this.addComponent(Billboard);
    }

    public showProgress(time:number) {
        this.time = time;
        this._timer = 0;

        this.node.active = true;
    }

    update(deltaTime: number) {
        this._timer += deltaTime;
        const scale = Math.min(1, this._timer / this.time);

        this._tempPos.x = scale;
        this.bar.setScale(this._tempPos);
        if (scale >= 1) {
            this.node.active = false;
            this._timer = 0;
        }
    }
}


