const fs = require('fs');
let code = fs.readFileSync('src/app/test-rls/page.jsx', 'utf8');

code = code.replace(/try \{/, 
`try {
      // Test 0: Try to make myself caregiver of a random person
      const { error: e0 } = await supabase.from('caregiver_relationships').insert({
        patient_id: fakeId,
        caregiver_id: user.id,
        status: 'active',
        permission_level: 'admin'
      });
      if (e0) log('Escalonamento de Privilégios (Cuidador)', true, 'Bloqueado por RLS: ' + e0.message);
      else log('Escalonamento de Privilégios (Cuidador)', false, 'Conseguiu se vincular a outro usuário sem convite!');`);

fs.writeFileSync('src/app/test-rls/page.jsx', code);
