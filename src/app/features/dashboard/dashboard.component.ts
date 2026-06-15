import { Component, ElementRef, OnInit, ViewChild, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { WorkoutService } from '../../core/services/workout.service';
import { AuthService } from '../../core/services/auth.service';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { Workout } from '../../core/models/workout.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    NzLayoutModule,
    NzMenuModule,
    NzCardModule,
    NzStatisticModule,
    NzIconModule,
    NzButtonModule,
    NzDropDownModule,
    NzTagModule,
    NzModalModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  @ViewChild('chatBody') private chatBody?: ElementRef<HTMLElement>;

  workouts = signal<Workout[]>([]);

  // --- CHATBOT STATE ---
  isChatOpen = signal(false);
  isTyping = signal(false);
  chatInput = signal('');
  chatMessages = signal<{role: 'user'|'ai', text: string}[]>([
    { role: 'ai', text: 'Hi! Tell me what ingredients you have or what your fitness goal is, and I’ll help you plan a simple meal.' }
  ]);

  totalWorkouts = computed(() => this.workouts().length);
  totalVolume = computed(() =>
    this.workouts().reduce((acc, w) => {
      const vol = w.exercises?.reduce((eAcc, e) => eAcc + e.sets * e.reps * e.weight, 0) || 0;
      return acc + vol;
    }, 0)
  );
  thisWeekWorkouts = computed(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return this.workouts().filter(w => new Date(w.date) >= weekAgo).length;
  });
  recentWorkouts = computed(() => [...this.workouts()].slice(0, 5));

  // --- CHATBOT LOGIC ---
  toggleChat() {
    this.isChatOpen.update(v => !v);
    if (this.isChatOpen()) {
      this.scrollToLatestMessage();
    }
  }

  useChatSuggestion(suggestion: string) {
    this.chatInput.set(suggestion);
  }

  sendMessage() {
    const text = this.chatInput().trim();
    if (!text) return;

    this.chatMessages.update(m => [...m, { role: 'user', text }]);
    this.chatInput.set('');
    this.isTyping.set(true);
    this.scrollToLatestMessage();

    // --- HTTP CALL PLACEHOLDER ---
    // TODO: Aici pui request-ul real către API-ul tău (ex: Groq, Gemini, OpenAI)
    // PROMPT DE SISTEM PENTRU API:
    /*
      "Ești un asistent STRICT pentru fitness și nutriție al aplicației FitTrack.
      Regula 1: Răspunzi DOAR la solicitări legate de rețete, calorii, macronutrienți, exerciții și sănătate sportivă.
      Regula 2: Dacă utilizatorul te întreabă ORICE altceva (codificare, politică, poezii, glume nespecifice, matematică din afara calculului de calorii), REFUZI clar și scurt, spunând că poți discuta doar despre nutriție și fitness.
      Regula 3: Fii concis, prietenos și oferă direct liste de alimente/idei de mese bazate DOAR pe ce are utilizatorul."
    */
    setTimeout(() => {
       this.chatMessages.update(m => [...m, {
         role: 'ai',
         text: 'Your Nutrition Coach is being connected. Soon, you’ll receive personalized meal and fitness suggestions here.'
       }]);
       this.isTyping.set(false);
       this.scrollToLatestMessage();

       // Seteaza setTimeout sa scroleze jos in cazul in care adaugi mult text
    }, 1500);
  }

  private scrollToLatestMessage() {
    setTimeout(() => {
      const chatBody = this.chatBody?.nativeElement;
      if (!chatBody) return;
      chatBody.scrollTop = chatBody.scrollHeight;
    });
  }

  constructor(
    private workoutService: WorkoutService,
    private authService: AuthService
  ) { }

  ngOnInit() {
    this.workoutService.getWorkouts().subscribe(data => {
      this.workouts.set(data);
      this.workoutService.workouts.set(data);
      this.workoutService.totalWorkouts.set(data.length);
    });
  }

  logout() {
    this.authService.logout().subscribe();
  }
}
