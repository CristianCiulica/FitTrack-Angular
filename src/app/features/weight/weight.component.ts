import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { ApiService } from '../../core/services/api.service';
import { ProfileService } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';
import { UserProfile } from '../../core/models/user-profile.model';
import { WeightEntry } from '../../core/models/weight-entry.model';
import { localDateKey, POUNDS_PER_KG, weightChart } from '../../core/utils/weight-progress';
import { AppMenuComponent } from '../../shared/components/app-menu/app-menu.component';

@Component({
  selector: 'app-weight', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, NzLayoutModule, NzMenuModule, NzIconModule, NzModalModule, AppMenuComponent],
  templateUrl: './weight.component.html', styleUrl: './weight.component.scss',
})
export class WeightComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly profile = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly modal = inject(NzModalService);
  readonly entries = signal<WeightEntry[]>([]);
  readonly loading = signal(true);
  readonly loaded = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly period = signal(30);
  readonly ranges = [{label:'1M',days:30},{label:'3M',days:90},{label:'6M',days:180},{label:'1Y',days:365},{label:'All',days:0}];
  readonly imperial = computed(() => this.profile.units() === 'imperial');
  readonly unit = computed(() => this.imperial() ? 'lb' : 'kg');
  readonly chart = computed(() => weightChart(this.entries(), this.period(), new Date(), this.imperial()));
  readonly latest = computed(() => this.entries().at(-1));
  readonly recent = computed(() => [...this.entries()].reverse());
  readonly selectedDate = signal('');
  readonly selected = computed(() => this.chart().points.find(p => p.date === this.selectedDate()) ?? this.chart().points.at(-1));
  readonly today = localDateKey();
  date = this.today;
  weight: number | null = null;
  readonly editing = computed(() => this.entries().some(e => e.date === this.formDate()));
  readonly formDate = signal(this.today);

  ngOnInit() { this.load(); }
  load() {
    this.loading.set(true); this.error.set('');
    this.api.get<{entries:WeightEntry[]}>('/me/weight-entries').subscribe({
      next: response => { this.entries.set(response.entries); this.loaded.set(true); this.loading.set(false); this.selectFormDate(); },
      error: () => { this.loading.set(false); this.error.set('Could not load your weight history. Please try again.'); },
    });
  }
  displayWeight(kg: number) { return kg * (this.imperial() ? POUNDS_PER_KG : 1); }
  selectFormDate() {
    this.formDate.set(this.date);
    const entry = this.entries().find(e => e.date === this.date);
    const kg = entry?.weightKg ?? this.latest()?.weightKg ?? this.profile.weightKg();
    this.weight = kg == null ? null : Math.round(this.displayWeight(kg) * 10) / 10;
    this.notice.set('');
  }
  valid() {
    const kg = Number(this.weight) / (this.imperial() ? POUNDS_PER_KG : 1);
    const date = new Date(`${this.date}T12:00:00Z`);
    return this.loaded() && this.weight != null && Number.isFinite(kg) && kg >= 1 && kg <= 500
      && Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === this.date
      && this.date >= '1900-01-01' && this.date <= this.today;
  }
  save() {
    if (!this.valid() || this.busy()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    const date = this.date;
    const weightKg = Math.round(Number(this.weight) / (this.imperial() ? POUNDS_PER_KG : 1) * 10000) / 10000;
    this.api.put<{entries:WeightEntry[];profile:UserProfile}>(`/me/weight-entries/${date}`, {weightKg}).subscribe({
      next: response => { this.accept(response); this.selectedDate.set(date); this.notice.set('Weight saved.'); },
      error: () => { this.busy.set(false); this.error.set('Your entry was not saved. Check your connection and try again.'); },
    });
  }
  edit(entry: WeightEntry) {
    this.date = entry.date; this.selectFormDate();
    document.getElementById('weight-input')?.focus();
  }
  remove(entry: WeightEntry) {
    if (this.busy()) return;
    this.modal.confirm({nzTitle:'Delete this weigh-in?',nzContent:`Remove the entry for ${entry.date}?`,nzOkText:'Delete',nzCancelText:'Keep entry',nzOkDanger:true,nzCentered:true,nzWidth:'min(400px, calc(100vw - 32px))',nzClassName:'solid-modal',
      nzOnOk: () => { this.busy.set(true); this.error.set(''); this.api.delete<{entries:WeightEntry[];profile:UserProfile}>(`/me/weight-entries/${entry.date}`).subscribe({
        next: response => { this.accept(response); this.selectFormDate(); this.notice.set('Entry deleted.'); },
        error: () => { this.busy.set(false); this.error.set('Could not delete this entry. Please try again.'); },
      }); },
    });
  }
  private accept(response: {entries:WeightEntry[];profile:UserProfile}) {
    this.entries.set(response.entries); this.busy.set(false);
    if (response.profile) this.profile.acceptServerProfile(response.profile);
  }
  logout() { this.auth.logout().subscribe(); }
}
