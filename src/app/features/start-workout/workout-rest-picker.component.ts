import { Component, ElementRef, ViewChild, output, signal } from '@angular/core';

const TICK_WIDTH = 12;
const STEP = 5;
const MAX_SECONDS = 900;

@Component({
  selector: 'app-workout-rest-picker',
  templateUrl: './workout-rest-picker.component.html',
  styleUrl: './workout-rest-picker.component.scss',
})
export class WorkoutRestPickerComponent {
  @ViewChild('dialog', { static: true }) private dialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('ruler', { static: true }) private ruler!: ElementRef<HTMLElement>;

  readonly started = output<number>();
  readonly seconds = signal(60);
  readonly ticks = Array.from({ length: MAX_SECONDS / STEP }, (_, index) => (index + 1) * STEP);
  readonly tickWidth = TICK_WIDTH;
  readonly maximum = MAX_SECONDS;
  private drag: { x: number; offset: number } | null = null;

  open() {
    if (this.dialog.nativeElement.open) return;
    this.seconds.set(60);
    this.dialog.nativeElement.showModal();
    this.select(60);
  }

  formatTime(seconds: number) {
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }

  readPosition() {
    const index = Math.round(this.ruler.nativeElement.scrollLeft / TICK_WIDTH);
    this.seconds.set(this.ticks[Math.max(0, Math.min(index, this.ticks.length - 1))]);
  }

  private select(seconds: number) {
    const value = Math.max(STEP, Math.min(seconds, MAX_SECONDS));
    this.seconds.set(value);
    this.ruler.nativeElement.scrollLeft = (value / STEP - 1) * TICK_WIDTH;
  }

  keyDown(event: KeyboardEvent) {
    const value = this.seconds();
    const keys: Record<string, number> = {
      ArrowLeft: value - STEP, ArrowDown: value - STEP, ArrowRight: value + STEP,
      ArrowUp: value + STEP, PageDown: value - 60, PageUp: value + 60, Home: STEP, End: MAX_SECONDS,
    };
    if (!Object.hasOwn(keys, event.key)) return;
    event.preventDefault();
    this.select(keys[event.key]);
  }

  pointerDown(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const ruler = this.ruler.nativeElement;
    this.drag = { x: event.clientX, offset: ruler.scrollLeft };
    ruler.setPointerCapture(event.pointerId);
  }

  pointerMove(event: PointerEvent) {
    if (this.drag) this.ruler.nativeElement.scrollLeft = this.drag.offset + this.drag.x - event.clientX;
  }

  pointerUp(event: PointerEvent) {
    const ruler = this.ruler.nativeElement;
    if (this.drag && Math.abs(event.clientX - this.drag.x) < 4) {
      const rect = ruler.getBoundingClientRect();
      const delta = Math.round((event.clientX - rect.left - rect.width / 2) / TICK_WIDTH);
      this.select(this.seconds() + delta * STEP);
    }
    this.drag = null;
  }

  cancelDrag() { this.drag = null; }

  start() {
    this.readPosition();
    this.dialog.nativeElement.close();
    this.started.emit(this.seconds());
  }
}
