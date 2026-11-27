plugins {
    kotlin("multiplatform")
    kotlin("plugin.compose")
    kotlin("plugin.serialization")
    id("org.jetbrains.compose")
    id("com.android.library")
}

kotlin {
    androidTarget { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
    // معاينة الشاشات على الكمبيوتر (صور PNG للمراجعة) — تُفعَّل بـ -Pkhb.preview فقط، ولا تدخل في التطبيق
    val preview = project.hasProperty("khb.preview")
    if (preview) jvm("desktop")
    // آيفون: يُفعَّل لاحقًا على جهاز ماك بإضافة iosArm64()/iosSimulatorArm64() وكتابة ملفات iosMain المقابلة
    // (WebModuleScreen و NourScreen و createHttpClient). كل الشاشات الأخرى مشتركة وجاهزة.

    sourceSets {
        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.ui)
            implementation(compose.components.resources)
            implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.2")
            implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
            implementation("io.ktor:ktor-client-core:3.3.3")
        }
        if (preview) getByName("desktopMain").dependencies {
            implementation(compose.desktop.currentOs)
            implementation("io.ktor:ktor-client-cio:3.3.3")
            implementation("org.jetbrains.kotlinx:kotlinx-coroutines-swing:1.10.2")
        }
        androidMain.dependencies {
            implementation("io.ktor:ktor-client-okhttp:3.3.3")
            implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
            implementation("androidx.activity:activity-compose:1.11.0")
            implementation("androidx.webkit:webkit:1.14.0")
        }
    }
}

android {
    namespace = "site.khaber.app"
    compileSdk = 36
    defaultConfig { minSdk = 24 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

compose.resources {
    publicResClass = false
    packageOfResClass = "site.khaber.app.res"
    generateResClass = always
}

if (project.hasProperty("khb.preview")) {
    tasks.register<JavaExec>("preview") {
        dependsOn("desktopJar")
        classpath = files(tasks.named("desktopJar")) + configurations.getByName("desktopRuntimeClasspath")
        mainClass.set("site.khaber.app.PreviewKt")
        args = (project.findProperty("previewArgs") as String? ?: "").split(" ").filter { it.isNotBlank() }
    }
}
