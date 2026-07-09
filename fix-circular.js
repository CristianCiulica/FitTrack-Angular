const fs = require('fs');

function fixCircular(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace import
  content = content.replace(/import \{ AuthService \} from '\.\/auth\.service';/, "import { Auth } from '@angular/fire/auth';");
  
  // Replace injection
  content = content.replace(/private readonly auth = inject\(AuthService\);/, "private readonly auth = inject(Auth);");
  
  // Replace currentUser() with currentUser
  content = content.replace(/this\.auth\.currentUser\(\)\?\.uid/g, "this.auth.currentUser?.uid");
  
  fs.writeFileSync(file, content);
  console.log('Fixed ' + file);
}

fixCircular('./src/app/core/services/profile.service.ts');
fixCircular('./src/app/core/services/workout.service.ts');
fixCircular('./src/app/core/services/running-session.service.ts');
