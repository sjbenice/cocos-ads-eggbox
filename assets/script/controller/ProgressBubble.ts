import { _decorator, Component, MeshRenderer, Node, sys } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ProgressBubble')
export class ProgressBubble extends Component {
    protected _meshRenderer:MeshRenderer = null;
    protected _count:number = 0;
    protected _index:number = 0;

    protected _autoReturnPlus:boolean = false;
    protected _autoReturnTimer:number = 0;

    public getTotalSteps() : number {
        return this._count;
    }

    protected onLoad(): void {
        this._meshRenderer = this.getComponent(MeshRenderer);

        this._count = this._meshRenderer.materials.length - 1;//this.node.children.length;
    }

    protected start(): void {
        this.showProgress(this._index);
    }
    
    public addStep(isPlus:boolean, autoReturnTime:number = 0) : boolean {
        if (!this.node.active)
            return false;

        const newIndex = this._index + (isPlus ? 1 : -1);
        if (newIndex >= this._count || newIndex < 0) {
            return true;
        }

        this.showProgress(newIndex);

        if (autoReturnTime > 0) {
            this._autoReturnTimer = sys.now() + autoReturnTime * 1000;
            this._autoReturnPlus = !isPlus;
        } else if (autoReturnTime == 0)
            this._autoReturnTimer = 0;

        return false;
    }

    public showProgress(newIndex:number) {
        if (this._meshRenderer) {
            if (newIndex > this._count - 1)
                newIndex = this._count - 1;
        
            this._meshRenderer.material = this._meshRenderer.materials[newIndex + 1];
        }
        // this.node.children[this._index].active = false;
        // this.node.children[newIndex].active = true;

        this._index = newIndex;
    }

    protected lateUpdate(dt: number): void {
        if (this._autoReturnTimer != 0 && sys.now() > this._autoReturnTimer) {
            if (this.addStep(this._autoReturnPlus, -1))
                this._autoReturnTimer = 0;
        }
    }
}


