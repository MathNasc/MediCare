# Kotlinx Serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class br.com.medicare.paciente.**$$serializer { *; }
-keepclassmembers class br.com.medicare.paciente.** {
    *** Companion;
}
-keepclasseswithmembers class br.com.medicare.paciente.** {
    kotlinx.serialization.KSerializer serializer(...);
}
