import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ReminderService } from './core/services/reminder.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent implements OnInit {
  constructor(private reminderService: ReminderService) {}

  ngOnInit(): void {
    this.reminderService.scheduleCheck();
  }
}
