const fs = require('fs');
const path = './src/app/core/services/profile.service.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /patch\(update: ProfileUpdate\): Observable<UserProfile> \{\n\s*const current = this\.profile\(\);\n\s*if \(current\) \{\n\s*this\.profile\.set\(\{ \.\.\.current, \.\.\.update \}\);\n\s*\}\n\s*return this\.api\.patch<\{ profile: UserProfile \}>\('\/me', update\)\.pipe\(\n\s*map\(\(res\) => res\.profile\),\n\s*tap\(\(profile\) => this\.profile\.set\(profile\)\),\n\s*catchError\(\(err\) => \{\n\s*console\.warn\('\[ProfileService\] API patch failed, falling back to optimistic UI state', err\);\n\s*return rxjs\.of\(\{ \.\.\.current, \.\.\.update \} as UserProfile\);\n\s*\}\)\n\s*\);\n\s*\}/,
  `patch(update: ProfileUpdate): Observable<UserProfile> {
    const current = this.profile() || {} as UserProfile;
    const newProfile = { ...current, ...update };
    
    // Always optimistic update
    this.profile.set(newProfile);
    
    return this.api.patch<{ profile: UserProfile }>('/me', update).pipe(
      map((res) => res.profile),
      tap((profile) => this.profile.set(profile)),
      catchError((err) => {
        console.warn('[ProfileService] API patch failed, falling back to optimistic UI state', err);
        return rxjs.of(newProfile);
      })
    );
  }`
);

fs.writeFileSync(path, code);
console.log('patched2');
