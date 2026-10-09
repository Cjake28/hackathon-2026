package expo.modules.floatingbubble

import android.animation.ValueAnimator
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.abs

// A Messenger-style chat head: a draggable circle drawn on top of the home
// screen and every other app. Android only, and only once the user has allowed
// "Draw over other apps" — tapping it opens the app at `url`.
class FloatingBubbleModule : Module() {
  private var bubble: View? = null
  private var layout: WindowManager.LayoutParams? = null
  private var openUrl: String? = null
  private val main = Handler(Looper.getMainLooper())

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val windows: WindowManager
    get() = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

  override fun definition() = ModuleDefinition {
    Name("FloatingBubble")

    Function("hasPermission") { Settings.canDrawOverlays(context) }

    Function("isVisible") { bubble != null }

    AsyncFunction("requestPermission") {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${context.packageName}")
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    AsyncFunction("show") { label: String, url: String ->
      if (!Settings.canDrawOverlays(context)) throw NoOverlayPermission()
      openUrl = url
      main.post { add(label) }
    }

    AsyncFunction("hide") { main.post { remove() } }

    // A JS reload builds a new module instance; drop the old window with it.
    OnDestroy { main.post { remove() } }
  }

  private fun add(label: String) {
    if (bubble != null) return
    val size = dp(60f)
    val view = circle(label, size)
    val metrics = context.resources.displayMetrics
    val params = WindowManager.LayoutParams(
      size,
      size,
      overlayType(),
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = metrics.widthPixels - size - dp(12f)
      y = metrics.heightPixels / 3
    }
    drag(view, params)
    windows.addView(view, params)
    bubble = view
    layout = params
  }

  private fun remove() {
    val view = bubble ?: return
    bubble = null
    layout = null
    runCatching { windows.removeView(view) }
  }

  private fun circle(label: String, size: Int): View {
    val root = FrameLayout(context)
    root.background = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(BRAND)
      setStroke(dp(2f), BRAND_EDGE)
    }
    root.clipToOutline = true
    root.elevation = dp(6f).toFloat()

    val icon = resource("ic_launcher_foreground")
    if (icon != 0) {
      val image = ImageView(context)
      image.setImageResource(icon)
      image.scaleType = ImageView.ScaleType.CENTER_INSIDE
      root.addView(image, FrameLayout.LayoutParams(size, size))
    } else {
      val text = TextView(context)
      text.text = label.take(1).uppercase()
      text.setTextColor(Color.WHITE)
      text.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
      text.gravity = Gravity.CENTER
      root.addView(text, FrameLayout.LayoutParams(size, size))
    }
    return root
  }

  // Follow the finger, then snap to whichever side is nearer. A press that
  // barely moves counts as a tap and opens the app.
  private fun drag(view: View, params: WindowManager.LayoutParams) {
    val slop = dp(8f)
    var downX = 0f
    var downY = 0f
    var startX = 0
    var startY = 0
    var moved = false

    view.setOnTouchListener { target, event ->
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          downX = event.rawX
          downY = event.rawY
          startX = params.x
          startY = params.y
          moved = false
          target.animate().scaleX(0.9f).scaleY(0.9f).setDuration(80).start()
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = event.rawX - downX
          val dy = event.rawY - downY
          if (abs(dx) > slop || abs(dy) > slop) moved = true
          params.x = (startX + dx).toInt()
          params.y = (startY + dy).toInt()
          runCatching { windows.updateViewLayout(target, params) }
          true
        }
        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
          target.animate().scaleX(1f).scaleY(1f).setDuration(120).start()
          if (moved) snap(target, params) else open()
          true
        }
        else -> false
      }
    }
  }

  private fun snap(view: View, params: WindowManager.LayoutParams) {
    val metrics = context.resources.displayMetrics
    val margin = dp(12f)
    val size = view.width.takeIf { it > 0 } ?: dp(60f)
    val right = metrics.widthPixels - size - margin
    val target = if (params.x + size / 2 > metrics.widthPixels / 2) right else margin
    params.y = params.y.coerceIn(margin, metrics.heightPixels - size - margin)

    ValueAnimator.ofInt(params.x, target).apply {
      duration = 180
      addUpdateListener {
        params.x = it.animatedValue as Int
        runCatching { windows.updateViewLayout(view, params) }
      }
      start()
    }
  }

  private fun open() {
    val launcher = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val url = openUrl
    val deepLink = if (url.isNullOrEmpty()) null else Intent(Intent.ACTION_VIEW, Uri.parse(url))
    for (intent in listOfNotNull(deepLink, launcher)) {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      if (runCatching { context.startActivity(intent) }.isSuccess) return
    }
  }

  private fun resource(name: String): Int {
    val mipmap = context.resources.getIdentifier(name, "mipmap", context.packageName)
    if (mipmap != 0) return mipmap
    return context.resources.getIdentifier(name, "drawable", context.packageName)
  }

  private fun dp(value: Float): Int =
    TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP,
      value,
      context.resources.displayMetrics
    ).toInt()

  @Suppress("DEPRECATION")
  private fun overlayType(): Int =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      WindowManager.LayoutParams.TYPE_PHONE
    }

  companion object {
    // --primary / --primary-edge from global.css
    private const val BRAND = 0xFF25B160.toInt()
    private const val BRAND_EDGE = 0xFF197640.toInt()
  }
}

class NoOverlayPermission :
  CodedException("Allow drawing over other apps for this app first")
