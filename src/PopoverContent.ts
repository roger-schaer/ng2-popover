import {Component, Input, AfterViewInit, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, EventEmitter, Renderer } from "@angular/core";
import {Popover} from "./Popover";
import {getHtmlTagDefinition} from "@angular/compiler/src/ml_parser/html_tags";

@Component({
    selector: "popover-content",
    template: `
<div #popoverDiv class="popover popover-{{ effectivePlacement }}"
[style.top]="top + 'px'"
     [style.left]="left + 'px'"
     [class.in]="isIn"
     [class.fade]="animation"
     style="display: block"
     role="popover">
    <div [hidden]="!closeOnMouseOutside" class="virtual-area"></div>
    <h3 class="popover-title" [hidden]="!title">{{ title }}</h3>
    <div class="popover-content">
        <ng-content></ng-content>
        {{ content }}
    </div>
</div>
`,
    styles: [`
.popover .virtual-area {
    height: 11px;
    width: 100%;
    position: absolute;
}
.popover.top .virtual-area {
    bottom: -11px; 
}
.popover.bottom .virtual-area {
    top: -11px; 
}
.popover.left .virtual-area {
    right: -11px; 
}
.popover.right .virtual-area {
    left: -11px; 
}
`]
})
export class PopoverContent implements AfterViewInit, OnDestroy {

    // -------------------------------------------------------------------------
    // Inputs / Outputs
    // -------------------------------------------------------------------------

    // @Input()
    // hostElement: HTMLElement;

    @Input()
    content: string;

    @Input()
    placement: "top"|"bottom"|"left"|"right"|"auto"|"auto top"|"auto bottom"|"auto left"|"auto right" = "bottom";

    @Input()
    title: string;

    @Input()
    animation: boolean = true;

    @Input()
    closeOnClickOutside: boolean = false;

    @Input()
    closeOnMouseOutside: boolean = false;

    // -------------------------------------------------------------------------
    // Properties
    // -------------------------------------------------------------------------

    @ViewChild("popoverDiv")
    popoverDiv: ElementRef;

    popover: Popover;
    onCloseFromOutside = new EventEmitter();
    top: number = -10000;
    left: number = -10000;
    isIn: boolean = false;
    displayType: string = "none";
    effectivePlacement: string;

    // -------------------------------------------------------------------------
    // Anonymous
    // -------------------------------------------------------------------------

    /**
     * Closes dropdown if user clicks outside of this directive.
     */
    onDocumentMouseDown = (event: any) => {
        const element = this.element.nativeElement;
        if (!element || !this.popover) return;
        if (element.contains(event.target) || this.popover.getElement().contains(event.target)) return;
        this.hide();
        this.onCloseFromOutside.emit(undefined);
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(protected element: ElementRef,
                protected cdr: ChangeDetectorRef,
                protected renderer: Renderer) {
    }

    // -------------------------------------------------------------------------
    // Lifecycle callbacks
    // -------------------------------------------------------------------------

    listenClickFunc: any;
    listenMouseFunc: any;
    ngAfterViewInit(): void {
        if (this.closeOnClickOutside)
            this.listenClickFunc = this.renderer.listenGlobal("document", "mousedown", (event: any) => this.onDocumentMouseDown(event));
        if (this.closeOnMouseOutside)
            this.listenMouseFunc = this.renderer.listenGlobal("document", "mouseover", (event: any) => this.onDocumentMouseDown(event));

        this.show();
        this.cdr.detectChanges();
    }

    ngOnDestroy() {
        if (this.closeOnClickOutside)
            this.listenClickFunc();
        if (this.closeOnMouseOutside)
            this.listenMouseFunc();
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    show(): void {
        if (!this.popover || !this.popover.getElement())
            return;

        const p = this.positionElements(this.popover.getElement(), this.popoverDiv.nativeElement, this.placement);
        this.displayType = "block";
        this.top = p.top;
        this.left = p.left;
        this.isIn = true;
    }

    hide(): void {
        this.top = -10000;
        this.left = -10000;
        this.isIn = true;
        this.popover.hide();
    }

    hideFromPopover() {
        this.top = -10000;
        this.left = -10000;
        this.isIn = true;
    }

    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------

    protected positionElements(hostEl: HTMLElement, targetEl: HTMLElement, positionStr: string, appendToBody: boolean = false): { top: number, left: number } {
        let positionStrParts = positionStr.split("-");
        let pos0 = positionStrParts[0];
        let pos1 = positionStrParts[1] || "center";
        let hostElPos = appendToBody ? this.offset(hostEl) : this.position(hostEl);
        let targetElWidth = targetEl.offsetWidth;
        let targetElHeight = targetEl.offsetHeight;

        this.effectivePlacement = pos0 = this.getEffectivePlacement(pos0, hostEl, targetEl);

        this.updatePlacement(this.effectivePlacement, hostEl, targetEl.getBoundingClientRect());

        let shiftWidth: any = {
            center: function (): number {
                return hostElPos.left + hostElPos.width / 2 - targetElWidth / 2;
            },
            left: function (): number {
                return hostElPos.left;
            },
            right: function (): number {
                return hostElPos.left + hostElPos.width;
            }
        };

        let shiftHeight: any = {
            center: function (): number {
                return hostElPos.top + hostElPos.height / 2 - targetElHeight / 2;
            },
            top: function (): number {
                return hostElPos.top;
            },
            bottom: function (): number {
                return hostElPos.top + hostElPos.height;
            }
        };

        let targetElPos: { top: number, left: number };
        switch (this.effectivePlacement) {
            case "right":
                targetElPos = {
                    top: shiftHeight[pos1](),
                    left: shiftWidth[this.effectivePlacement]()
                };
                break;

            case "left":
                targetElPos = {
                    top: shiftHeight[pos1](),
                    left: hostElPos.left - targetElWidth
                };
                break;

            case "bottom":
                targetElPos = {
                    top: shiftHeight[this.effectivePlacement](),
                    left: shiftWidth[pos1]()
                };
                break;

            default:
                targetElPos = {
                    top: hostElPos.top - targetElHeight,
                    left: shiftWidth[pos1]()
                };
                break;
        }

        targetElPos.left = targetElPos.left >= 0 ? targetElPos.left : 11;
        targetElPos.top = targetElPos.top >= 0 ? targetElPos.top : 11;

        return targetElPos;
    }

    protected updatePlacement(placement: string, hostEl: HTMLElement, targetElBoundingRect: ClientRect) {
        let hostElBoundingRect: ClientRect = hostEl.getBoundingClientRect();
        let hostElOffsetParent: Element = hostEl.offsetParent;
        let hostElOffsetParentHeight: number = hostElOffsetParent.scrollHeight;

        switch (placement) {
            case "left":
                if (targetElBoundingRect.width > hostElBoundingRect.left && targetElBoundingRect.width <= hostElBoundingRect.right) {
                   this.effectivePlacement = "right";
                }
                break;
            case "right":
                if (targetElBoundingRect.width > hostElBoundingRect.right && targetElBoundingRect.width <= hostElBoundingRect.left) {
                    this.effectivePlacement = "left";
                }
                break;
            case "top":
                if (targetElBoundingRect.height > hostElBoundingRect.top && targetElBoundingRect.height <= hostElBoundingRect.bottom) {
                    this.effectivePlacement = "bottom";
                }
                break;
            case "bottom":
                if (targetElBoundingRect.height > hostElOffsetParentHeight && targetElBoundingRect.height <= hostElBoundingRect.top) {
                    this.effectivePlacement = "top";
                }
                break;
        }

    }

    protected position(nativeEl: HTMLElement): { width: number, height: number, top: number, left: number } {
        let offsetParentBCR = { top: 0, left: 0 };
        const elBCR = this.offset(nativeEl);
        const offsetParentEl = this.parentOffsetEl(nativeEl);
        if (offsetParentEl !== window.document) {
            offsetParentBCR = this.offset(offsetParentEl);
            offsetParentBCR.top += offsetParentEl.clientTop - offsetParentEl.scrollTop;
            offsetParentBCR.left += offsetParentEl.clientLeft - offsetParentEl.scrollLeft;
        }

        const boundingClientRect = nativeEl.getBoundingClientRect();
        return {
            width: boundingClientRect.width || nativeEl.offsetWidth,
            height: boundingClientRect.height || nativeEl.offsetHeight,
            top: elBCR.top - offsetParentBCR.top,
            left: elBCR.left - offsetParentBCR.left
        };
    }

    protected offset(nativeEl: any): { width: number, height: number, top: number, left: number } {
        const boundingClientRect = nativeEl.getBoundingClientRect();
        return {
            width: boundingClientRect.width || nativeEl.offsetWidth,
            height: boundingClientRect.height || nativeEl.offsetHeight,
            top: boundingClientRect.top + (window.pageYOffset || window.document.documentElement.scrollTop),
            left: boundingClientRect.left + (window.pageXOffset || window.document.documentElement.scrollLeft)
        };
    }

    protected getStyle(nativeEl: HTMLElement, cssProp: string): string {
        if ((nativeEl as any).currentStyle) // IE
            return (nativeEl as any).currentStyle[cssProp];

        if (window.getComputedStyle)
            return (window.getComputedStyle as any)(nativeEl)[cssProp];

        // finally try and get inline style
        return (nativeEl.style as any)[cssProp];
    }

    protected isStaticPositioned(nativeEl: HTMLElement): boolean {
        return (this.getStyle(nativeEl, "position") || "static" ) === "static";
    }

    protected parentOffsetEl(nativeEl: HTMLElement): any {
        let offsetParent: any = nativeEl.offsetParent || window.document;
        while (offsetParent && offsetParent !== window.document && this.isStaticPositioned(offsetParent)) {
            offsetParent = offsetParent.offsetParent;
        }
        return offsetParent || window.document;
    }

    protected getEffectivePlacement(placement: string, hostElement: HTMLElement, targetElement: HTMLElement): string {
        const placementParts = placement.split(" ");
        if (placementParts[0] !== "auto") {
            return placement;
        }

        const hostElBoundingRect = hostElement.getBoundingClientRect();

        const desiredPlacement = placementParts[1] || "bottom";

        if (desiredPlacement === "top" && hostElBoundingRect.top - targetElement.offsetHeight < 0) {
            return "bottom";
        }
        if (desiredPlacement === "bottom" && hostElBoundingRect.bottom + targetElement.offsetHeight > window.innerHeight) {
            return "top";
        }
        if (desiredPlacement === "left" && hostElBoundingRect.left - targetElement.offsetWidth < 0) {
            return "right";
        }
        if (desiredPlacement === "right" && hostElBoundingRect.right + targetElement.offsetWidth > window.innerWidth) {
            return "left";
        }

        return desiredPlacement;
    }
}
