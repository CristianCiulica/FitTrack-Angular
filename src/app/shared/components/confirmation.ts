import { Component, Injectable, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef, NzModalService } from 'ng-zorro-antd/modal';

type ConfirmAction = () => unknown;

interface ConfirmationOptions {
  nzTitle: string;
  nzContent?: string;
  nzCancelText: string;
  nzOkText: string;
  nzOkDanger?: boolean;
  nzOnOk?: ConfirmAction;
  stats?: { label: string; value: string }[];
  secondaryText?: string;
  onSecondary?: ConfirmAction;
}

@Component({
  template: `
    <h2>{{ options.nzTitle }}</h2>
    @if (options.nzContent) { <p>{{ options.nzContent }}</p> }
    @if (options.stats?.length) {
      <dl class="confirmation-stats">@for (stat of options.stats; track stat.label) {
        <div><dt>{{ stat.label }}</dt><dd>{{ stat.value }}</dd></div>
      }</dl>
    }
    <div class="confirmation-actions">
      <button type="button" class="confirmation-keep" [disabled]="busy()" (click)="ref.triggerCancel()">{{ options.nzCancelText || 'Cancel' }}</button>
      @if (options.secondaryText) {
        <button type="button" class="confirmation-secondary" [disabled]="busy()" (click)="confirm(options.onSecondary)">{{ options.secondaryText }}</button>
      }
      <button type="button" [class.confirmation-danger]="options.nzOkDanger" class="confirmation-proceed" [disabled]="busy()" (click)="confirm(options.nzOnOk)">{{ busy() ? 'Please wait…' : options.nzOkText || 'Confirm' }}</button>
      @if (failed()) { <p role="alert">Could not complete this action. Please try again.</p> }
    </div>
  `,
})
export class ConfirmationComponent {
  readonly options = inject<ConfirmationOptions>(NZ_MODAL_DATA);
  readonly ref = inject(NzModalRef);
  readonly busy = signal(false);
  readonly failed = signal(false);

  ngAfterViewInit(): void {
    const dialog = this.ref.getElement().closest('[role="dialog"]');
    dialog?.setAttribute('aria-label', this.options.nzTitle);
    dialog?.setAttribute('aria-modal', 'true');
  }

  async confirm(action?: ConfirmAction): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    this.ref.updateConfig({ nzClosable: false, nzKeyboard: false, nzMaskClosable: false });
    try {
      const result = await action?.();
      if (result !== false) this.ref.close();
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
      this.ref.updateConfig({ nzKeyboard: true });
    }
  }
}

@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  private readonly modal = inject(NzModalService);
  confirm(options: ConfirmationOptions): NzModalRef {
    return this.modal.create({
      nzContent: ConfirmationComponent, nzData: options,
      nzFooter: null, nzClosable: false, nzMaskClosable: false,
      nzCentered: true, nzWidth: 'min(440px, calc(100vw - 40px))',
      nzClassName: 'app-confirmation',
      nzOnCancel: () => true,
    });
  }
}
