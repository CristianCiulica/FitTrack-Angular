const fs = require('fs');
const path = './src/app/core/services/profile.service.ts';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('catchError')) {
  code = code.replace(/import \{ map, tap \} from 'rxjs\/operators';/, "import { map, tap, catchError } from 'rxjs/operators';");
}

code = code.replace(
  /return this\.api\.patch<\{ profile: UserProfile \}>\('\/me', update\)\.pipe\(\n\s*map\(\(res\) => res\.profile\),\n\s*tap\(\(profile\) => this\.profile\.set\(profile\)\),\n\s*\);/g,
  `return this.api.patch<{ profile: UserProfile }>('/me', update).pipe(
      map((res) => res.profile),
      tap((profile) => this.profile.set(profile)),
      catchError((err) => {
        console.warn('[ProfileService] API patch failed, falling back to optimistic UI state', err);
        return rxjs.of({ ...current, ...update } as UserProfile);
      })
    );`
);

// We also need to import rxjs if it's not already imported in a way that allows rxjs.of
if (!code.includes('import * as rxjs from')) {
  code = "import * as rxjs from 'rxjs';\n" + code;
}

fs.writeFileSync(path, code);
console.log('patched');
