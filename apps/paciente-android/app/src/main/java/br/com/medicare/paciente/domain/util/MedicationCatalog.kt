package br.com.medicare.paciente.domain.util

import androidx.compose.ui.graphics.Color

data class CatalogMedication(
    val name: String,
    val activeIngredient: String,
    val dosage: String,
    val form: String,
    val type: String, // reference | generic | similar
    val category: String,
    val presentation: String
)

data class MedicineTypeBadgeInfo(
    val label: String,
    val shortLabel: String,
    val color: Color
)

/**
 * Catálogo local de medicamentos registrados no Brasil (ANVISA),
 * espelhando fielmente `src/data/medicationCatalog.js`.
 */
object MedicationCatalog {

    val MEDICINE_TYPES = mapOf(
        "reference" to MedicineTypeBadgeInfo("Referência", "Ref", Color(0xFF3B82F6)),
        "generic" to MedicineTypeBadgeInfo("Genérico (G)", "Gen", Color(0xFFEAB308)),
        "similar" to MedicineTypeBadgeInfo("Similar", "Sim", Color(0xFF8B5CF6))
    )

    val POPULAR_CATEGORIES = listOf(
        "Anti-hipertensivos",
        "Diabetes",
        "Colesterol",
        "Dor / Febre",
        "Estômago",
        "Tireoide",
        "Vitaminas"
    )

    val MEDICATION_CATALOG = listOf(
        // Anti-hipertensivos
        CatalogMedication("Losartana Potássica", "Losartana potássica", "50mg", "comprimido", "generic", "Anti-hipertensivos", "50mg · Comprimido revestido"),
        CatalogMedication("Cozaar", "Losartana potássica", "50mg", "comprimido", "reference", "Anti-hipertensivos", "50mg · Comprimido revestido"),
        CatalogMedication("Aradois", "Losartana potássica", "50mg", "comprimido", "similar", "Anti-hipertensivos", "50mg · Comprimido revestido"),
        CatalogMedication("Enalapril", "Maleato de enalapril", "10mg", "comprimido", "generic", "Anti-hipertensivos", "10mg · Comprimido"),
        CatalogMedication("Anlodipino", "Besilato de anlodipino", "5mg", "comprimido", "generic", "Anti-hipertensivos", "5mg · Comprimido"),
        CatalogMedication("Hidroclorotiazida", "Hidroclorotiazida", "25mg", "comprimido", "generic", "Anti-hipertensivos", "25mg · Comprimido"),
        CatalogMedication("Atenolol", "Atenolol", "50mg", "comprimido", "generic", "Anti-hipertensivos", "50mg · Comprimido"),
        CatalogMedication("Selozok", "Succinato de metoprolol", "50mg", "comprimido", "reference", "Anti-hipertensivos", "50mg · Comprimido liberação controlada"),

        // Diabetes
        CatalogMedication("Metformina", "Cloridrato de metformina", "850mg", "comprimido", "generic", "Diabetes", "850mg · Comprimido revestido"),
        CatalogMedication("Glifage XR", "Cloridrato de metformina", "500mg", "comprimido", "reference", "Diabetes", "500mg · Ação prolongada"),
        CatalogMedication("Glibenclamida", "Glibenclamida", "5mg", "comprimido", "generic", "Diabetes", "5mg · Comprimido"),
        CatalogMedication("Forxiga", "Dapagliflozina", "10mg", "comprimido", "reference", "Diabetes", "10mg · Comprimido revestido"),
        CatalogMedication("Jardiance", "Empagliflozina", "25mg", "comprimido", "reference", "Diabetes", "25mg · Comprimido revestido"),

        // Colesterol
        CatalogMedication("Sinvastatina", "Sinvastatina", "20mg", "comprimido", "generic", "Colesterol", "20mg · Comprimido revestido"),
        CatalogMedication("Atorvastatina Cálcica", "Atorvastatina cálcica", "20mg", "comprimido", "generic", "Colesterol", "20mg · Comprimido revestido"),
        CatalogMedication("Rosuvastatina Cálcica", "Rosuvastatina cálcica", "10mg", "comprimido", "generic", "Colesterol", "10mg · Comprimido revestido"),
        CatalogMedication("Crestor", "Rosuvastatina cálcica", "10mg", "comprimido", "reference", "Colesterol", "10mg · Comprimido revestido"),

        // Dor / Febre / SOS
        CatalogMedication("Dipirona Monoidratada", "Dipirona monoidratada", "1g", "comprimido", "generic", "Dor / Febre", "1g · Comprimido"),
        CatalogMedication("Novalgina", "Dipirona monoidratada", "1g", "comprimido", "reference", "Dor / Febre", "1g · Comprimido"),
        CatalogMedication("Paracetamol", "Paracetamol", "750mg", "comprimido", "generic", "Dor / Febre", "750mg · Comprimido revestido"),
        CatalogMedication("Tylenol", "Paracetamol", "750mg", "comprimido", "reference", "Dor / Febre", "750mg · Comprimido"),
        CatalogMedication("Ibuprofeno", "Ibuprofeno", "600mg", "comprimido", "generic", "Dor / Febre", "600mg · Comprimido"),
        CatalogMedication("Dorflex", "Dipirona + Orfenadrina + Cafeína", "300mg", "comprimido", "similar", "Dor / Febre", "300mg + 35mg + 50mg · Comprimido"),

        // Estômago
        CatalogMedication("Omeprazol", "Omeprazol", "20mg", "cápsula", "generic", "Estômago", "20mg · Cápsula dura"),
        CatalogMedication("Pantoprazol", "Pantoprazol sódico", "40mg", "comprimido", "generic", "Estômago", "40mg · Comprimido gastrorresistente"),
        CatalogMedication("Vonau Flash", "Cloridrato de ondansetrona", "8mg", "comprimido", "similar", "Estômago", "8mg · Desintegração oral"),

        // Tireoide
        CatalogMedication("Puran T4", "Levotiroxina sódica", "50mcg", "comprimido", "reference", "Tireoide", "50mcg · Comprimido"),
        CatalogMedication("Euthyrox", "Levotiroxina sódica", "75mcg", "comprimido", "reference", "Tireoide", "75mcg · Comprimido"),
        CatalogMedication("Levotiroxina Sódica", "Levotiroxina sódica", "100mcg", "comprimido", "generic", "Tireoide", "100mcg · Comprimido"),

        // Vitaminas & Antibióticos
        CatalogMedication("Vitamina D3", "Colecalciferol", "2000UI", "cápsula", "similar", "Vitaminas", "2000UI · Cápsula mole"),
        CatalogMedication("Addera D3", "Colecalciferol", "7000UI", "cápsula", "reference", "Vitaminas", "7000UI · Cápsula mole"),
        CatalogMedication("Vitamina B12", "Cianocobalamina", "1000mcg", "comprimido", "similar", "Vitaminas", "1000mcg · Comprimido"),
        CatalogMedication("Amoxicilina", "Amoxicilina tri-hidratada", "500mg", "cápsula", "generic", "Antibióticos", "500mg · Cápsula dura"),
        CatalogMedication("Azitromicina", "Azitromicina di-hidratada", "500mg", "comprimido", "generic", "Antibióticos", "500mg · Comprimido revestido")
    )

    fun searchLocal(query: String, limit: Int = 8): List<CatalogMedication> {
        val q = query.trim().lowercase()
        if (q.length < 2) return emptyList()
        return MEDICATION_CATALOG.filter {
            it.name.lowercase().contains(q) ||
                it.activeIngredient.lowercase().contains(q) ||
                it.category.lowercase().contains(q)
        }.take(limit)
    }

    fun getPopularByCategory(category: String): List<CatalogMedication> {
        return MEDICATION_CATALOG.filter { it.category.equals(category, ignoreCase = true) }
    }
}
