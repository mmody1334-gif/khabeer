plugins {
    id("com.android.application")
    kotlin("android")
    kotlin("plugin.compose")
}

android {
    namespace = "om.khabeer.app"
    compileSdk = 36
    defaultConfig {
        // المعرّف ثابت كما في الإصدارات السابقة: التحديث يُثبَّت فوق التطبيق القديم بلا حذف
        applicationId = "om.khabeer.app"
        minSdk = 24
        targetSdk = 36
        val run = System.getenv("GITHUB_RUN_NUMBER") ?: "1"
        versionCode = run.toInt()
        versionName = "2.$run"
    }
    flavorDimensions += "brand"
    productFlavors {
        create("khabeer") {
            dimension = "brand"
            applicationId = "om.khabeer.app"
            buildConfigField("String", "SITE_URL", "\"https://khaber.site\"")
        }
    }
    // مفتاح التوقيع ثابت دائمًا (السر KEYSTORE_B64 في إعدادات المستودع، الاسم المستعار tahdir).
    // لا تغيّره أبدًا: تغييره يمنع تثبيت التحديث فوق التطبيق الموجود عند المعلمين.
    signingConfigs {
        create("release") {
            storeFile = file("tahdir.keystore")
            storePassword = System.getenv("KEYSTORE_PASSWORD")
            keyAlias = "tahdir"
            keyPassword = System.getenv("KEYSTORE_PASSWORD")
        }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("release")
        }
        // نسخة مطابقة للإصدار (مع التصغير R8) لكن بمفتاح التجربة — للاختبار على المحاكي فقط
        create("preview") {
            initWith(getByName("release"))
            signingConfig = signingConfigs.getByName("debug")
            matchingFallbacks += "release"
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { buildConfig = true; compose = true }
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    implementation(project(":shared"))
    implementation("androidx.activity:activity-compose:1.11.0")
}

// نسخة احتياطية من أداة نور داخل التطبيق (أول تشغيل بلا إنترنت): تُؤخذ من الموقع وقت البناء،
// ثم يجلب التطبيق أحدث نسخة من khaber.site عند كل تشغيل.
val copyTool by tasks.registering(Copy::class) {
    from(rootProject.file("site/server/tahdir-noor.user.js")) { rename { "tool.user.js" } }
    into(layout.projectDirectory.dir("src/main/assets"))
}
tasks.named("preBuild") { dependsOn(copyTool) }
