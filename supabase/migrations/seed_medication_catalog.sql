-- ═══════════════════════════════════════════════════════════════════
--  MediCare — Seed: Catálogo de Medicamentos
--  Execute no SQL Editor do Supabase APÓS a migration 004_medication_catalog.sql
--  Popula a tabela medication_catalog com medicamentos brasileiros.
--  search_vector é atualizado automaticamente pelo trigger.
-- ═══════════════════════════════════════════════════════════════════

-- Limpa dados anteriores (idempotente)
truncate table public.medication_catalog restart identity cascade;

-- ─── Inserção em lote ────────────────────────────────────────────────────────
insert into public.medication_catalog
  (commercial_name, active_ingredient, dosage, pharmaceutical_form, unit, manufacturer, medicine_type, is_reference, is_generic, is_similar)
values
-- ANTI-HIPERTENSIVOS
  ('Cozaar 25mg','Losartana Potássica','25mg','Comprimido Revestido','comprimido','Organon','referencia',true,false,false),
  ('Cozaar 50mg','Losartana Potássica','50mg','Comprimido Revestido','comprimido','Organon','referencia',true,false,false),
  ('Cozaar 100mg','Losartana Potássica','100mg','Comprimido Revestido','comprimido','Organon','referencia',true,false,false),
  ('Losartana Potássica 25mg','Losartana Potássica','25mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Losartana Potássica 50mg','Losartana Potássica','50mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Losartana Potássica 100mg','Losartana Potássica','100mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Losartana Potássica 50mg','Losartana Potássica','50mg','Comprimido','comprimido','Medley','generico',false,true,false),
  ('Losartana Potássica 50mg','Losartana Potássica','50mg','Comprimido','comprimido','Neo Química','generico',false,true,false),
  ('Losartana Potássica 50mg','Losartana Potássica','50mg','Comprimido','comprimido','Eurofarma','generico',false,true,false),
  ('Aradois 50mg','Losartana Potássica','50mg','Comprimido Revestido','comprimido','Biolab','similar',false,false,true),
  ('Hyzaar 50/12,5mg','Losartana + HCTZ','50/12,5mg','Comprimido Revestido','comprimido','Organon','referencia',true,false,false),
  ('Norvasc 5mg','Anlodipino','5mg','Comprimido','comprimido','Pfizer','referencia',true,false,false),
  ('Norvasc 10mg','Anlodipino','10mg','Comprimido','comprimido','Pfizer','referencia',true,false,false),
  ('Anlodipino 5mg','Anlodipino','5mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Anlodipino 10mg','Anlodipino','10mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Presid 5mg','Anlodipino','5mg','Comprimido','comprimido','Biolab','similar',false,false,true),
  ('Captopril 25mg','Captopril','25mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Captopril 50mg','Captopril','50mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Enalapril 10mg','Maleato de Enalapril','10mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Enalapril 20mg','Maleato de Enalapril','20mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Renitec 20mg','Maleato de Enalapril','20mg','Comprimido','comprimido','MSD','referencia',true,false,false),
  ('Lisinopril 10mg','Lisinopril','10mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Lisinopril 20mg','Lisinopril','20mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Valsartana 80mg','Valsartana','80mg','Comprimido','comprimido','Medley','generico',false,true,false),
  ('Valsartana 160mg','Valsartana','160mg','Comprimido','comprimido','Medley','generico',false,true,false),
  ('Diovan 80mg','Valsartana','80mg','Comprimido','comprimido','Novartis','referencia',true,false,false),
  ('Diovan 160mg','Valsartana','160mg','Comprimido','comprimido','Novartis','referencia',true,false,false),
  ('Atenolol 50mg','Atenolol','50mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Atenolol 100mg','Atenolol','100mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Tenormin 50mg','Atenolol','50mg','Comprimido','comprimido','AstraZeneca','referencia',true,false,false),
  ('Propranolol 40mg','Cloridrato de Propranolol','40mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Carvedilol 6,25mg','Carvedilol','6,25mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Carvedilol 25mg','Carvedilol','25mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Bisoprolol 5mg','Fumarato de Bisoprolol','5mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Concor 5mg','Fumarato de Bisoprolol','5mg','Comprimido','comprimido','Merck','referencia',true,false,false),
  ('Hidroclorotiazida 25mg','Hidroclorotiazida','25mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Furosemida 40mg','Furosemida','40mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Lasix 40mg','Furosemida','40mg','Comprimido','comprimido','Sanofi','referencia',true,false,false),
  ('Espironolactona 25mg','Espironolactona','25mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Aldactone 25mg','Espironolactona','25mg','Comprimido','comprimido','Pfizer','referencia',true,false,false),
  ('Adalat Oros 30mg','Nifedipino','30mg','Comprimido Lib. Ext.','comprimido','Bayer','referencia',true,false,false),

-- ANALGÉSICOS / ANTI-INFLAMATÓRIOS
  ('Novalgina 500mg','Dipirona Monoidratada','500mg','Comprimido','comprimido','Sanofi','referencia',true,false,false),
  ('Novalgina Gotas','Dipirona Monoidratada','500mg/ml','Solução Oral','ml','Sanofi','referencia',true,false,false),
  ('Dipirona 500mg','Dipirona Monoidratada','500mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Dipirona Gotas','Dipirona Monoidratada','500mg/ml','Solução Oral','ml','EMS','generico',false,true,false),
  ('Tylenol 500mg','Paracetamol','500mg','Comprimido','comprimido','Kenvue','referencia',true,false,false),
  ('Tylenol 750mg','Paracetamol','750mg','Comprimido','comprimido','Kenvue','referencia',true,false,false),
  ('Paracetamol 500mg','Paracetamol','500mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Paracetamol 750mg','Paracetamol','750mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Aspirina 100mg','Ácido Acetilsalicílico','100mg','Comprimido','comprimido','Bayer','referencia',true,false,false),
  ('Aspirina 500mg','Ácido Acetilsalicílico','500mg','Comprimido','comprimido','Bayer','referencia',true,false,false),
  ('AAS 100mg','Ácido Acetilsalicílico','100mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Ibuprofeno 400mg','Ibuprofeno','400mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Ibuprofeno 600mg','Ibuprofeno','600mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Advil 400mg','Ibuprofeno','400mg','Cápsula Gelatinosa','cápsula','Haleon','referencia',true,false,false),
  ('Diclofenaco 50mg','Diclofenaco de Potássio','50mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Cataflam 50mg','Diclofenaco de Potássio','50mg','Comprimido','comprimido','Novartis','referencia',true,false,false),
  ('Voltaren 50mg','Diclofenaco de Sódio','50mg','Comprimido','comprimido','Haleon','referencia',true,false,false),
  ('Nimesulida 100mg','Nimesulida','100mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Nisulid 100mg','Nimesulida','100mg','Comprimido','comprimido','Aché','similar',false,false,true),
  ('Celecoxibe 200mg','Celecoxibe','200mg','Cápsula','cápsula','EMS','generico',false,true,false),
  ('Celebra 200mg','Celecoxibe','200mg','Cápsula','cápsula','Pfizer','referencia',true,false,false),
  ('Tramadol 50mg','Cloridrato de Tramadol','50mg','Cápsula','cápsula','EMS','generico',false,true,false),
  ('Tramal 50mg','Cloridrato de Tramadol','50mg','Cápsula','cápsula','Pfizer','referencia',true,false,false),

-- ESTATINAS / COLESTEROL
  ('Sinvastatina 20mg','Sinvastatina','20mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Sinvastatina 40mg','Sinvastatina','40mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Zocor 20mg','Sinvastatina','20mg','Comprimido','comprimido','MSD','referencia',true,false,false),
  ('Rosuvastatina 10mg','Rosuvastatina Cálcica','10mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Rosuvastatina 20mg','Rosuvastatina Cálcica','20mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Crestor 10mg','Rosuvastatina Cálcica','10mg','Comprimido','comprimido','AstraZeneca','referencia',true,false,false),
  ('Crestor 20mg','Rosuvastatina Cálcica','20mg','Comprimido','comprimido','AstraZeneca','referencia',true,false,false),
  ('Atorvastatina 20mg','Atorvastatina Cálcica','20mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Atorvastatina 40mg','Atorvastatina Cálcica','40mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Lipitor 20mg','Atorvastatina Cálcica','20mg','Comprimido','comprimido','Pfizer','referencia',true,false,false),
  ('Ezetimiba 10mg','Ezetimiba','10mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Zetia 10mg','Ezetimiba','10mg','Comprimido','comprimido','Organon','referencia',true,false,false),

-- DIABETES
  ('Metformina 500mg','Cloridrato de Metformina','500mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Metformina 850mg','Cloridrato de Metformina','850mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Glifage 850mg','Cloridrato de Metformina','850mg','Comprimido','comprimido','Merck','referencia',true,false,false),
  ('Glifage XR 500mg','Cloridrato de Metformina','500mg','Comprimido Lib. Ext.','comprimido','Merck','referencia',true,false,false),
  ('Glifage XR 750mg','Cloridrato de Metformina','750mg','Comprimido Lib. Ext.','comprimido','Merck','referencia',true,false,false),
  ('Glibenclamida 5mg','Glibenclamida','5mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Gliclazida 30mg','Gliclazida','30mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Diamicron MR 30mg','Gliclazida','30mg','Comprimido Lib. Mod.','comprimido','Servier','referencia',true,false,false),
  ('Sitagliptina 100mg','Sitagliptina','100mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Januvia 100mg','Sitagliptina','100mg','Comprimido','comprimido','MSD','referencia',true,false,false),
  ('Forxiga 10mg','Dapagliflozina','10mg','Comprimido','comprimido','AstraZeneca','referencia',true,false,false),
  ('Jardiance 10mg','Empagliflozina','10mg','Comprimido','comprimido','Boehringer','referencia',true,false,false),
  ('Jardiance 25mg','Empagliflozina','25mg','Comprimido','comprimido','Boehringer','referencia',true,false,false),
  ('Ozempic 0,5mg','Semaglutida','0,5mg','Solução Injetável','ml','Novo Nordisk','referencia',true,false,false),
  ('Ozempic 1mg','Semaglutida','1mg','Solução Injetável','ml','Novo Nordisk','referencia',true,false,false),
  ('Lantus 100UI','Insulina Glargina','100UI/ml','Solução Injetável','ml','Sanofi','referencia',true,false,false),
  ('Insulina NPH 100UI','Insulina Isofana','100UI/ml','Solução Injetável','ml','Novo Nordisk','referencia',true,false,false),

-- GÁSTRICOS
  ('Omeprazol 20mg','Omeprazol','20mg','Cápsula','cápsula','EMS','generico',false,true,false),
  ('Omeprazol 40mg','Omeprazol','40mg','Cápsula','cápsula','EMS','generico',false,true,false),
  ('Losec 20mg','Omeprazol','20mg','Cápsula','cápsula','AstraZeneca','referencia',true,false,false),
  ('Pantoprazol 40mg','Pantoprazol Sódico','40mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Pantozol 40mg','Pantoprazol Sódico','40mg','Comprimido','comprimido','Takeda','referencia',true,false,false),
  ('Nexium 40mg','Esomeprazol Magnésico','40mg','Comprimido','comprimido','AstraZeneca','referencia',true,false,false),
  ('Esomeprazol 40mg','Esomeprazol Magnésico','40mg','Cápsula','cápsula','EMS','generico',false,true,false),
  ('Domperidona 10mg','Domperidona','10mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Motilium 10mg','Domperidona','10mg','Comprimido','comprimido','Haleon','referencia',true,false,false),
  ('Buscopan 10mg','Brometo de Butilescopolamina','10mg','Comprimido','comprimido','Boehringer','referencia',true,false,false),
  ('Buscopan Composto','Butilescopolamina + Dipirona','10mg+500mg','Comprimido','comprimido','Boehringer','referencia',true,false,false),

-- ANTIBIÓTICOS
  ('Amoxicilina 500mg','Amoxicilina','500mg','Cápsula','cápsula','EMS','generico',false,true,false),
  ('Amoxil 500mg','Amoxicilina','500mg','Cápsula','cápsula','GSK','referencia',true,false,false),
  ('Clavulin BD 875mg','Amoxicilina + Clavulanato','875/125mg','Comprimido','comprimido','GSK','referencia',true,false,false),
  ('Azitromicina 500mg','Azitromicina','500mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Zitromax 500mg','Azitromicina','500mg','Comprimido','comprimido','Pfizer','referencia',true,false,false),
  ('Cefalexina 500mg','Cefalexina','500mg','Cápsula','cápsula','EMS','generico',false,true,false),
  ('Ciprofloxacino 500mg','Cloridrato de Ciprofloxacino','500mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Cipro 500mg','Cloridrato de Ciprofloxacino','500mg','Comprimido','comprimido','Bayer','referencia',true,false,false),
  ('Metronidazol 250mg','Metronidazol','250mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Flagyl 250mg','Metronidazol','250mg','Comprimido','comprimido','Pfizer','referencia',true,false,false),
  ('Doxiciclina 100mg','Cloridrato de Doxiciclina','100mg','Cápsula','cápsula','EMS','generico',false,true,false),
  ('Levofloxacino 500mg','Levofloxacino','500mg','Comprimido','comprimido','EMS','generico',false,true,false),

-- SAÚDE MENTAL
  ('Fluoxetina 20mg','Cloridrato de Fluoxetina','20mg','Cápsula','cápsula','EMS','generico',false,true,false),
  ('Prozac 20mg','Cloridrato de Fluoxetina','20mg','Cápsula','cápsula','Lilly','referencia',true,false,false),
  ('Sertralina 50mg','Cloridrato de Sertralina','50mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Sertralina 100mg','Cloridrato de Sertralina','100mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Zoloft 50mg','Cloridrato de Sertralina','50mg','Comprimido','comprimido','Pfizer','referencia',true,false,false),
  ('Escitalopram 10mg','Oxalato de Escitalopram','10mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Lexapro 10mg','Oxalato de Escitalopram','10mg','Comprimido','comprimido','Lundbeck','referencia',true,false,false),
  ('Paroxetina 20mg','Cloridrato de Paroxetina','20mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Amitriptilina 25mg','Cloridrato de Amitriptilina','25mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Venlafaxina 75mg','Cloridrato de Venlafaxina','75mg','Cápsula','cápsula','EMS','generico',false,true,false),
  ('Efexor XR 75mg','Cloridrato de Venlafaxina','75mg','Cápsula Lib. Ext.','cápsula','Pfizer','referencia',true,false,false),
  ('Duloxetina 60mg','Cloridrato de Duloxetina','60mg','Cápsula','cápsula','EMS','generico',false,true,false),
  ('Cymbalta 60mg','Cloridrato de Duloxetina','60mg','Cápsula','cápsula','Lilly','referencia',true,false,false),
  ('Clonazepam 2mg','Clonazepam','2mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Rivotril 2mg','Clonazepam','2mg','Comprimido','comprimido','Roche','referencia',true,false,false),
  ('Rivotril 0,5mg','Clonazepam','0,5mg','Comprimido','comprimido','Roche','referencia',true,false,false),
  ('Alprazolam 0,5mg','Alprazolam','0,5mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Alprazolam 1mg','Alprazolam','1mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Xanax 0,5mg','Alprazolam','0,5mg','Comprimido','comprimido','Pfizer','referencia',true,false,false),
  ('Diazepam 5mg','Diazepam','5mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Quetiapina 25mg','Fumarato de Quetiapina','25mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Seroquel 25mg','Fumarato de Quetiapina','25mg','Comprimido','comprimido','AstraZeneca','referencia',true,false,false),
  ('Olanzapina 5mg','Olanzapina','5mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Zyprexa 5mg','Olanzapina','5mg','Comprimido','comprimido','Lilly','referencia',true,false,false),
  ('Risperidona 2mg','Risperidona','2mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Risperdal 2mg','Risperidona','2mg','Comprimido','comprimido','Janssen','referencia',true,false,false),
  ('Bupropiona 150mg','Cloridrato de Bupropiona','150mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Wellbutrin XL 150mg','Cloridrato de Bupropiona','150mg','Comprimido Lib. Ext.','comprimido','Biovail','referencia',true,false,false),
  ('Carbamazepina 200mg','Carbamazepina','200mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Tegretol 200mg','Carbamazepina','200mg','Comprimido','comprimido','Novartis','referencia',true,false,false),
  ('Valproato 250mg','Valproato de Sódio','250mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Depakote 250mg','Valproato Semissódico','250mg','Comprimido','comprimido','AbbVie','referencia',true,false,false),
  ('Gabapentina 300mg','Gabapentina','300mg','Cápsula','cápsula','EMS','generico',false,true,false),
  ('Neurontin 300mg','Gabapentina','300mg','Cápsula','cápsula','Pfizer','referencia',true,false,false),
  ('Pregabalina 75mg','Pregabalina','75mg','Cápsula','cápsula','EMS','generico',false,true,false),
  ('Lyrica 75mg','Pregabalina','75mg','Cápsula','cápsula','Pfizer','referencia',true,false,false),
  ('Zolpidem 10mg','Tartarato de Zolpidem','10mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Stilnox 10mg','Tartarato de Zolpidem','10mg','Comprimido','comprimido','Sanofi','referencia',true,false,false),
  ('Donepezila 10mg','Cloridrato de Donepezila','10mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Aricept 5mg','Cloridrato de Donepezila','5mg','Comprimido','comprimido','Pfizer','referencia',true,false,false),

-- RESPIRATÓRIO
  ('Aerolin Spray','Sulfato de Salbutamol','100mcg/dose','Aerossol','dose','GSK','referencia',true,false,false),
  ('Salbutamol Aerossol','Sulfato de Salbutamol','100mcg/dose','Aerossol','dose','GSK','generico',false,true,false),
  ('Pulmicort 200mcg','Budesonida','200mcg/dose','Aerossol','dose','AstraZeneca','referencia',true,false,false),
  ('Symbicort 160/4,5mcg','Budesonida + Formoterol','160/4,5mcg','Aerossol','dose','AstraZeneca','referencia',true,false,false),
  ('Seretide 25/250mcg','Salmeterol + Fluticasona','25/250mcg','Aerossol','dose','GSK','referencia',true,false,false),
  ('Montelucaste 10mg','Montelucaste de Sódio','10mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Singulair 10mg','Montelucaste de Sódio','10mg','Comprimido','comprimido','Organon','referencia',true,false,false),
  ('Spiriva 18mcg','Brometo de Tiotropio','18mcg','Cápsula Inal.','cápsula','Boehringer','referencia',true,false,false),
  ('Atrovent 0,25mg','Brometo de Ipratrópio','0,25mg/ml','Solução Nebul.','ml','Boehringer','referencia',true,false,false),

-- TIREOIDE
  ('Levotiroxina 25mcg','Levotiroxina Sódica','25mcg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Levotiroxina 50mcg','Levotiroxina Sódica','50mcg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Levotiroxina 100mcg','Levotiroxina Sódica','100mcg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Puran T4 25mcg','Levotiroxina Sódica','25mcg','Comprimido','comprimido','Abbott','referencia',true,false,false),
  ('Puran T4 50mcg','Levotiroxina Sódica','50mcg','Comprimido','comprimido','Abbott','referencia',true,false,false),
  ('Puran T4 100mcg','Levotiroxina Sódica','100mcg','Comprimido','comprimido','Abbott','referencia',true,false,false),
  ('Tapazol 10mg','Metimazol','10mg','Comprimido','comprimido','EMS','generico',false,true,false),

-- VITAMINAS / SUPLEMENTOS
  ('Vitamina D3 1000UI','Colecalciferol','1000UI','Cápsula','cápsula','EMS','generico',false,true,false),
  ('Vitamina D3 2000UI','Colecalciferol','2000UI','Cápsula','cápsula','EMS','generico',false,true,false),
  ('Vitamina D3 5000UI','Colecalciferol','5000UI','Cápsula','cápsula','EMS','generico',false,true,false),
  ('Depura 1000UI','Colecalciferol','1000UI','Comprimido','comprimido','Sanofi','similar',false,false,true),
  ('Addera D3 2000UI','Colecalciferol','2000UI','Comprimido','comprimido','Takeda','similar',false,false,true),
  ('Vitamina B12 1mg','Cianocobalamina','1mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Vitamina C 500mg','Ácido Ascórbico','500mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Redoxon 1g','Ácido Ascórbico','1g','Comprimido Efervescente','comprimido','Bayer','similar',false,false,true),
  ('Sulfato Ferroso 40mg','Sulfato Ferroso','40mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Ácido Fólico 5mg','Ácido Fólico','5mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Ômega 3 1000mg','Ácidos Graxos Ômega-3','1g','Cápsula Gelatinosa','cápsula','EMS','generico',false,true,false),

-- ANTICOAGULANTES
  ('Varfarina 5mg','Varfarina Sódica','5mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Marevan 5mg','Varfarina Sódica','5mg','Comprimido','comprimido','Sanofi','referencia',true,false,false),
  ('Xarelto 10mg','Rivaroxabana','10mg','Comprimido','comprimido','Bayer','referencia',true,false,false),
  ('Xarelto 20mg','Rivaroxabana','20mg','Comprimido','comprimido','Bayer','referencia',true,false,false),
  ('Eliquis 5mg','Apixabana','5mg','Comprimido','comprimido','BMS/Pfizer','referencia',true,false,false),
  ('Pradaxa 150mg','Dabigatrana Etexilato','150mg','Cápsula','cápsula','Boehringer','referencia',true,false,false),
  ('Clopidogrel 75mg','Clopidogrel','75mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Plavix 75mg','Clopidogrel','75mg','Comprimido','comprimido','Sanofi','referencia',true,false,false),
  ('Amiodarona 200mg','Cloridrato de Amiodarona','200mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Cordarone 200mg','Cloridrato de Amiodarona','200mg','Comprimido','comprimido','Sanofi','referencia',true,false,false),

-- CORTICOIDES
  ('Prednisona 5mg','Prednisona','5mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Prednisona 20mg','Prednisona','20mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Meticorten 5mg','Prednisona','5mg','Comprimido','comprimido','Schering','referencia',true,false,false),
  ('Dexametasona 4mg','Dexametasona','4mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Decadron 0,5mg','Dexametasona','0,5mg','Comprimido','comprimido','Prodotti','referencia',true,false,false),
  ('Medrol 4mg','Metilprednisolona','4mg','Comprimido','comprimido','Pfizer','referencia',true,false,false),

-- ANTI-HISTAMÍNICOS
  ('Loratadina 10mg','Loratadina','10mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Claritin 10mg','Loratadina','10mg','Comprimido','comprimido','Organon','referencia',true,false,false),
  ('Cetirizina 10mg','Dicloridrato de Cetirizina','10mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Zyrtec 10mg','Dicloridrato de Cetirizina','10mg','Comprimido','comprimido','Haleon','referencia',true,false,false),
  ('Fexofenadina 180mg','Cloridrato de Fexofenadina','180mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Allegra 180mg','Cloridrato de Fexofenadina','180mg','Comprimido','comprimido','Sanofi','referencia',true,false,false),
  ('Desloratadina 5mg','Desloratadina','5mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Aerius 5mg','Desloratadina','5mg','Comprimido','comprimido','Organon','referencia',true,false,false),

-- OSTEOPOROSE
  ('Alendronato 70mg','Alendronato de Sódio','70mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Fosamax 70mg','Alendronato de Sódio','70mg','Comprimido','comprimido','Organon','referencia',true,false,false),
  ('Actonel 35mg','Risedronato de Sódio','35mg','Comprimido','comprimido','Sanofi','referencia',true,false,false),
  ('Bonviva 150mg','Ibandronato de Sódio','150mg','Comprimido','comprimido','Roche','referencia',true,false,false),

-- ÁCIDO ÚRICO
  ('Alopurinol 100mg','Alopurinol','100mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Alopurinol 300mg','Alopurinol','300mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Zyloric 300mg','Alopurinol','300mg','Comprimido','comprimido','Aspen','referencia',true,false,false),
  ('Colchicina 0,5mg','Colchicina','0,5mg','Comprimido','comprimido','EMS','generico',false,true,false),

-- DISFUNÇÃO ERÉTIL
  ('Sildenafila 50mg','Citrato de Sildenafila','50mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Viagra 50mg','Citrato de Sildenafila','50mg','Comprimido','comprimido','Pfizer','referencia',true,false,false),
  ('Tadalafila 5mg','Tadalafila','5mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Tadalafila 20mg','Tadalafila','20mg','Comprimido','comprimido','EMS','generico',false,true,false),
  ('Cialis 5mg','Tadalafila','5mg','Comprimido','comprimido','Lilly','referencia',true,false,false),

-- SAÚDE DA MULHER
  ('Yasmin','Etinilestradiol+Drospirenona','0,03/3mg','Comprimido','comprimido','Bayer','referencia',true,false,false),
  ('Yaz','Etinilestradiol+Drospirenona','0,02/3mg','Comprimido','comprimido','Bayer','referencia',true,false,false),
  ('Microvlar','Etinilestradiol+Levonorgestrel','0,03/0,15mg','Comprimido','comprimido','Bayer','similar',false,false,true),
  ('Diane 35','Etinilestradiol+Acetato de Ciproterona','0,035/2mg','Comprimido','comprimido','Bayer','referencia',true,false,false),
  ('Premarin 0,625mg','Estrogênios Conjugados','0,625mg','Comprimido','comprimido','Pfizer','referencia',true,false,false),
  ('Utrogestan 100mg','Progesterona','100mg','Cápsula','cápsula','Besins','referencia',true,false,false),
  ('Progesterona 100mg','Progesterona','100mg','Cápsula','cápsula','EMS','generico',false,true,false);

-- ─── Verificação ─────────────────────────────────────────────────────────────
select count(*) as total_medicamentos from public.medication_catalog;

-- Teste de busca após seed:
-- select * from public.search_medications('losartana', 10);
-- select * from public.search_medications('dipirona', 10);
-- select * from public.search_medications('omeprazol', 10);
