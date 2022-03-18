---
title: Creating a Camera Application
version: v4.12
date: 2020-05-10
github: https://github.com/DJI-Mobile-SDK-Tutorials/Android-FPVDemo
keywords: [Android FPVDemo, capture, shoot photo, take photo, record video, basic tutorial]
---

*If you come across any mistakes or bugs in this tutorial, please let us know using a Github issue or a post on the DJI forum. Please feel free to send us Github pull request and help us fix any issues.*

---

This tutorial is designed for you to gain a basic understanding of the DJI Mobile SDK. It will implement the FPV view and two basic camera functionalities: **Take Photo** and **Record video**.

You can download the tutorial's final sample project from this [Github Page](https://github.com/DJI-Mobile-SDK-Tutorials/Android-FPVDemo).

## Preparation

### Setup Android Development Environment

  Throughout this tutorial we will be using Android Studio 3.0, which you can download from here: <a href="http://developer.android.com/sdk/index.html" target="_blank">http://developer.android.com/sdk/index.html</a>.

## Application Activation and Aircraft Binding in China

 For DJI SDK mobile application used in China, it's required to activate the application and bind the aircraft to the user's DJI account.

 If an application is not activated, the aircraft not bound (if required), or a legacy version of the SDK (< 4.1) is being used, all **camera live streams** will be disabled, and flight will be limited to a zone of 100m diameter and 30m height to ensure the aircraft stays within line of sight.

 To learn how to implement this feature, please check this tutorial [Application Activation and Aircraft Binding](./ActivationAndBinding.html).

## Implementing the UI of Application

### Importing Maven Dependency

Open Android Studio and select **File -> New -> New Project** to create a new project, named 'FPVDemo'. Enter the company domain and package name (Here we use "com.dji.FPVDemo") you want and press Next. Set the minimum SDK version as `API 19: Android 4.4 (KitKat)` for "Phone and Tablet" and press Next. Then select "Empty Activity" and press Next. Lastly, leave the Activity Name as "MainActivity", and the Layout Name as "activity_main", Press "Finish" to create the project.

In our previous tutorial [Importing and Activating DJI SDK in Android Studio Project](../application-development-workflow/workflow-integrate.html#Android-Studio-Project-Integration), you have learned how to import the Android SDK Maven Dependency and activate your application. If you haven't read that previously, please take a look at it and implement the related features. Once you've done that, continue to implement the next features.

### Building the Layouts of Activity

#### 1. Creating MApplication Class

Right click on the `com.dji.FPVDemo`, and select **New->Java Class** to create a new java class and name it as "MApplication".

Then, open the **MApplication.java** file and replace the content with the following:

~~~java
package com.dji.FPVDemo;

import android.app.Application;
import android.content.Context;

import com.secneo.sdk.Helper;

public class MApplication extends Application {

    private FPVDemoApplication fpvDemoApplication;
    @Override
    protected void attachBaseContext(Context paramContext) {
        super.attachBaseContext(paramContext);
        Helper.install(MApplication.this);
        if (fpvDemoApplication == null) {
            fpvDemoApplication = new FPVDemoApplication();
            fpvDemoApplication.setContext(this);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        fpvDemoApplication.onCreate();
    }

}
~~~

Here we firstly override the `attachBaseContext()` method to invoke the `install()` method of `Helper` class to load the SDK classes before using any SDK functionality. Failing to do so will result in unexpected crashes. Next, override the `onCreate()` method to invoke the `onCreate()` method of `FPVDemoApplication`.

#### 2. Creating FPVDemoApplication Class

Right-click on the package `com.dji.FPVDemo` in the project navigator and choose **New -> Java Class**, Type in "FPVDemoApplication" in the Name field and select "Class" as Kind field content.

Next, Replace the code of the "FPVDemoApplication.java" file with the following:

~~~java
package com.dji.FPVDemo;
import android.app.Application;

public class FPVDemoApplication extends Application{

    @Override
    public void onCreate() {
        super.onCreate();
    }
}
~~~

Here, we override the onCreate() method. We can do some settings when the application is created here.

#### 3. Implementing MainActivity Class

The MainActivity.java file is created by Android Studio by default. Let's replace the code of it with the following:

~~~java
public class MainActivity extends Activity implements TextureView.SurfaceTextureListener, View.OnClickListener {

    protected TextureView mVideoSurface = null;
    private Button mCaptureBtn, mShootPhotoModeBtn, mRecordVideoModeBtn;
    private ToggleButton mRecordBtn;
    private TextView recordingTime;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        setContentView(R.layout.activity_main);
        initUI();
    }

    @Override
    public void onResume() {
        super.onResume();
    }

    @Override
    public void onPause() {
        super.onPause();
    }

    @Override
    public void onStop() {
        super.onStop();
    }

    public void onReturn(View view){
        this.finish();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
    }

    @Override
    public void onSurfaceTextureAvailable(SurfaceTexture surface, int width, int height) {
    }

    @Override
    public void onSurfaceTextureSizeChanged(SurfaceTexture surface, int width, int height) {
    }

    @Override
    public boolean onSurfaceTextureDestroyed(SurfaceTexture surface) {
        return false;
    }

    @Override
    public void onSurfaceTextureUpdated(SurfaceTexture surface) {
    }

    private void initUI() {
        // init mVideoSurface
        mVideoSurface = (TextureView)findViewById(R.id.video_previewer_surface);

        recordingTime = (TextView) findViewById(R.id.timer);
        mCaptureBtn = (Button) findViewById(R.id.btn_capture);
        mRecordBtn = (ToggleButton) findViewById(R.id.btn_record);
        mShootPhotoModeBtn = (Button) findViewById(R.id.btn_shoot_photo_mode);
        mRecordVideoModeBtn = (Button) findViewById(R.id.btn_record_video_mode);

        if (null != mVideoSurface) {
            mVideoSurface.setSurfaceTextureListener(this);
        }

        mCaptureBtn.setOnClickListener(this);
        mRecordBtn.setOnClickListener(this);
        mShootPhotoModeBtn.setOnClickListener(this);
        mRecordVideoModeBtn.setOnClickListener(this);

        recordingTime.setVisibility(View.INVISIBLE);

        mRecordBtn.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {

           }
        });
    }

    @Override
    public void onClick(View v) {
        switch (v.getId()) {
            case R.id.btn_capture:{
                break;
            }
            case R.id.btn_shoot_photo_mode:{
                break;
            }
            case R.id.btn_record_video_mode:{
                break;
            }
            default:
                break;
        }
    }

}
~~~

In the code shown above, we implement the following features:

**1.** Create the layout UI elements variables, including a TextureView `mVideoSurface`, three Buttons `mCaptureBtn`, `mShootPhotoModeBtn`, `mRecordVideoModeBtn`, one Toggle Button `mRecordBtn` and a TextView `recordingTime `.

**2.** Then invoke the `initUI()` method to initialize UI variables. And implement the `setOnClickListener()` method of Button for all the Buttons. Also implement the `setOnCheckedChangeListener()` method for Toggle Button.

**3.** Override the `onClick()` method to implement the three Buttons' click actions.

#### 4. Implementing the MainActivity Layout

Open the **activity_main.xml** layout file and replace the code with the following:

~~~xml
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical">

    <TextureView
        android:id="@+id/video_previewer_surface"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:layout_gravity="center"
        android:layout_centerHorizontal="true"
        android:layout_above="@+id/linearLayout" />

     <LinearLayout
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:orientation="horizontal"
      android:layout_alignParentBottom="true"
         android:id="@+id/linearLayout">
    <Button
        android:id="@+id/btn_capture"
        android:layout_width="0dp"
        android:layout_weight="1"
        android:layout_gravity="center_vertical"
        android:layout_height="wrap_content"
        android:text="Capture"
        android:textSize="12sp"/>

    <ToggleButton
        android:id="@+id/btn_record"
        android:layout_width="0dp"
        android:layout_height="wrap_content"
        android:text="Start Record"
        android:textOff="Start Record"
        android:textOn="Stop Record"
        android:layout_weight="1"
        android:layout_gravity="center_vertical"
        android:textSize="12dp"
        android:checked="false" />

    <Button
        android:id="@+id/btn_shoot_photo_mode"
        android:layout_width="0dp"
        android:layout_weight="1"
        android:layout_height="wrap_content"
        android:layout_gravity="center_vertical"
        android:text="Shoot Photo Mode"
        android:textSize="12sp"/>

    <Button
        android:id="@+id/btn_record_video_mode"
        android:layout_width="0dp"
        android:layout_height="wrap_content"
        android:text="Record Video Mode"
        android:layout_weight="1"
        android:layout_gravity="center_vertical" />

     </LinearLayout>

    <TextView
        android:id="@+id/timer"
        android:layout_width="150dp"
        android:layout_weight="1"
        android:layout_height="wrap_content"
        android:layout_gravity="center_vertical"
        android:layout_marginTop="23dp"
        android:gravity="center"
        android:textColor="#ffffff"
        android:layout_alignTop="@+id/video_previewer_surface"
        android:layout_centerHorizontal="true" />

</RelativeLayout>
~~~

  In the xml file, we create a TextureView(id: video_previewer_surface) element to show the live video stream from the camera. Moreover, we implement a LinearLayout element to create the "Capture" Button(id: btn_capture), "Record" ToggleButton(id: btn_record), "Shoot Photo Mode" Button(id: btn_shoot_photo_mode) and "Record Video Mode" Button(id: btn_record_video_mode).

  Lastly, we create a TextView(id: timer) element to show the record video time.

#### 5. Implementing ConnectionActivity Class

  To improve the user experience, we had better create an activity to show the connection status between the DJI Product and the SDK, once it's connected, the user can press the **OPEN** button to enter the **MainActivity**.

  Now let's Right-click on the package `com.dji.FPVDemo` in the project navigator and choose **New -> Activity -> Basic Activity**, Type in "ConnectionActivity" in the "Activity Name" field and press "Finish" button.

  Next, replace the code of the "ConnectionActivity.java" file with the following:

~~~java
public class ConnectionActivity extends Activity implements View.OnClickListener {

    private static final String TAG = ConnectionActivity.class.getName();

    private TextView mTextConnectionStatus;
    private TextView mTextProduct;
    private TextView mVersionTv;
    private Button mBtnOpen;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        setContentView(R.layout.activity_connection);
        initUI();
    }

    @Override
    public void onResume() {
        Log.e(TAG, "onResume");
        super.onResume();
    }

    @Override
    public void onPause() {
        Log.e(TAG, "onPause");
        super.onPause();
    }

    @Override
    public void onStop() {
        Log.e(TAG, "onStop");
        super.onStop();
    }

    public void onReturn(View view){
        Log.e(TAG, "onReturn");
        this.finish();
    }

    @Override
    protected void onDestroy() {
        Log.e(TAG, "onDestroy");
        super.onDestroy();
    }

    private void initUI() {
        mTextConnectionStatus = (TextView) findViewById(R.id.text_connection_status);
        mTextProduct = (TextView) findViewById(R.id.text_product_info);

        mVersionTv = (TextView) findViewById(R.id.textView2);
        mVersionTv.setText(getResources().getString(R.string.sdk_version, DJISDKManager.getInstance().getSDKVersion()));

        mBtnOpen = (Button) findViewById(R.id.btn_open);
        mBtnOpen.setOnClickListener(this);
        mBtnOpen.setEnabled(false);
    }

    @Override
    public void onClick(View v) {
        switch (v.getId()) {
            case R.id.btn_open: {
                break;
            }
            default:
                break;
        }
    }

}
~~~

In the code shown above, we implement the following features:

1. Create the layout UI elements variables, including three TextureViews `mTextConnectionStatus`, `mTextProduct`, `mVersionTv` and one Button `mBtnOpen`.

2. In the onCreate() method, we invoke the `initUI()` methods to initialize the UI elements.

3. Next, implement the `initUI()` method to initialize the three TextViews and the Button. Then invoke `setOnClickListener()` method of `mBtnOpen` and pass `this` as the param.

4. Lastly, override the onClick() method to implement the Button's click action.

#### 6. Implementing the ConnectionActivity Layout

Open the **activity_connection.xml** layout file and replace the code with the following:

~~~xml
<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical">

    <TextView
        android:id="@+id/text_connection_status"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:gravity="center"
        android:text="Status: No Product Connected"
        android:textColor="@android:color/black"
        android:textSize="20dp"
        android:textStyle="bold"
        android:layout_alignBottom="@+id/text_product_info"
        android:layout_centerHorizontal="true"
        android:layout_marginBottom="89dp" />

    <TextView
        android:id="@+id/text_product_info"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_centerHorizontal="true"
        android:layout_marginTop="270dp"
        android:text="@string/product_information"
        android:textColor="@android:color/black"
        android:textSize="20dp"
        android:gravity="center"
        android:textStyle="bold"
        />

    <Button
        android:id="@+id/btn_open"
        android:layout_width="150dp"
        android:layout_height="55dp"
        android:layout_centerHorizontal="true"
        android:layout_marginTop="350dp"
        android:background="@drawable/round_btn"
        android:text="Open"
        android:textColor="@color/colorWhite"
        android:textSize="20dp"
        />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_centerHorizontal="true"
        android:layout_marginTop="430dp"
        android:text="@string/sdk_version"
        android:textSize="15dp"
        android:id="@+id/textView2" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:textAppearance="?android:attr/textAppearanceSmall"
        android:text="DJIFPVDemo"
        android:id="@+id/textView"
        android:layout_marginTop="58dp"
        android:textStyle="bold"
        android:textSize="20dp"
        android:textColor="@color/colorBlack"
        android:layout_alignParentTop="true"
        android:layout_centerHorizontal="true" />

</RelativeLayout>
~~~

  In the xml file, we create four TextViews and one Button within a RelativeLayout. We use the TextView(id: text\_connection\_status) to show the product connection status and use the TextView(id:text\_product\_info) to show the connected product name. The Button(id: btn\_open) is used to open the **MainActivity**.

#### 7. Configuring the Resource XMLs

  Once you finish the above steps, let's copy all the images file from this Github sample project's **drawable** folder (**app->src->main->res->drawable**) to the same folder in your project.

  ![imageFiles](../images/tutorials-and-samples/Android/FPVDemo/imageFiles.png)

  Moreover, open the "colors.xml" file and update the content as shown below:

~~~xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorWhite">#FFFFFF</color>
    <color name="colorBlack">#000000</color>
    <color name="colorPrimary">#3F51B5</color>
    <color name="colorPrimaryDark">#303F9F</color>
    <color name="colorAccent">#FF4081</color>
</resources>
~~~

  Furthermore, open the "strings.xml" file and replace the content with the followings:

~~~xml
<?xml version="1.0" encoding="utf-8"?>
<resources>

    <string name="app_name">DJI FPV Demo</string>
    <string name="action_settings">Settings</string>   
    <string name="disconnected">Disconnected</string>
    <string name="product_information">Product Information</string>
    <string name="connection_loose">Status: No Product Connected</string>
    <string name="sdk_version">DJI SDK Version: %1$s</string>

</resources>
~~~

  Lastly, open the "styles.xml" file and replace the content with the followings:

~~~xml
<resources>

    <!-- Base application theme. -->
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <!-- Customize your theme here. -->
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
    </style>

</resources>
~~~

Now, if you open the activity_main.xml file, and click on the **Design** tab on the bottom left, you should see the preview screenshots of **MainActivity** and **ConnectionActivity** as shown below:

- ConnectionActivity

<img src="../images/tutorials-and-samples/Android/FPVDemo/connectionActivityImage.png" width=30%>

- MainActivity

<img src="../images/tutorials-and-samples/Android/FPVDemo/mainActivityImage.png" width=70%>

For more details, please check the Github source code of this tutorial.

## Registering the Application

After you finish the above steps, let's register our application with the **App Key** you apply from DJI Developer Website. If you are not familiar with the App Key, please check the [Get Started](../quick-start/index.html).

**1.** Let's open the AndroidManifest.xml file and add the following elements on top of the **application** element:

~~~xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
<uses-permission android:name="android.permission.MOUNT_UNMOUNT_FILESYSTEMS" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
<uses-permission android:name="android.permission.READ_PHONE_STATE" />

<uses-feature android:name="android.hardware.camera" />
<uses-feature android:name="android.hardware.camera.autofocus" />
<uses-feature
    android:name="android.hardware.usb.host"
    android:required="false" />
<uses-feature
    android:name="android.hardware.usb.accessory"
    android:required="true" />
~~~

Here, we request permissions that the application must be granted in order for it to register DJI SDK correctly. Also, we declare the camera and USB hardwares which are used by the application.

Next, add the `android:name=".MApplication"` at the beginning of the `application` element:

~~~xml
<application
    android:name=".MApplication"
    android:allowBackup="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
    android:supportsRtl="true"
    android:theme="@style/AppTheme">
~~~

Moreover, let's add the following elements as childs of element on top of the "ConnectionActivity" activity element as shown below:

~~~xml
<!-- DJI SDK -->
<uses-library android:name="com.android.future.usb.accessory" />
<meta-data
    android:name="com.dji.sdk.API_KEY"
    android:value="Please enter your APP Key here." />

<activity
    android:name="dji.sdk.sdkmanager.DJIAoaControllerActivity"
    android:theme="@android:style/Theme.Translucent" >
    <intent-filter>
        <action android:name="android.hardware.usb.action.USB_ACCESSORY_ATTACHED" />
    </intent-filter>

    <meta-data
        android:name="android.hardware.usb.action.USB_ACCESSORY_ATTACHED"
        android:resource="@xml/accessory_filter" />
</activity>
<service android:name="dji.sdk.sdkmanager.DJIGlobalService" >
</service>
<!-- DJI SDK -->
~~~

In the code above, you should substitute your **App Key** of the application for "Please enter your App Key here." in the **value** attribute under the `android:name="com.dji.sdk.API_KEY"` attribute.

Lastly, update the "MainActivity" and "ConnectionActivity" activity elements as shown below:

~~~xml
<activity android:name=".ConnectionActivity"
    android:configChanges="orientation"
    android:screenOrientation="portrait">

    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
</activity>
<activity android:name=".MainActivity"
    android:screenOrientation="landscape"></activity>
~~~

In the code above, we add the attributes of "android:screenOrientation" to set "ConnectionActivity" as **portrait** and set "MainActivity" as **landscape**.

**2.** After you finish the steps above, open the "FPVDemoApplication.java" file and replace the code with the same file in the Github Source Code, here we explain the important parts of it:

~~~java
@Override
public void onCreate() {
    super.onCreate();
    mHandler = new Handler(Looper.getMainLooper());

    /**
     * When starting SDK services, an instance of interface DJISDKManager.DJISDKManagerCallback will be used to listen to
     * the SDK Registration result and the product changing.
     */
    mDJISDKManagerCallback = new DJISDKManager.SDKManagerCallback() {

        //Listens to the SDK registration result
        @Override
        public void onRegister(DJIError error) {

            if(error == DJISDKError.REGISTRATION_SUCCESS) {

                Handler handler = new Handler(Looper.getMainLooper());
                handler.post(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(getApplicationContext(), "Register Success", Toast.LENGTH_LONG).show();
                    }
                });

                DJISDKManager.getInstance().startConnectionToProduct();

            } else {

                Handler handler = new Handler(Looper.getMainLooper());
                handler.post(new Runnable() {

                    @Override
                    public void run() {
                        Toast.makeText(getApplicationContext(), "Register sdk fails, check network is available", Toast.LENGTH_LONG).show();
                    }
                });

            }
            Log.e("TAG", error.toString());
        }

        @Override
        public void onProductDisconnect() {
            Log.d("TAG", "onProductDisconnect");
            notifyStatusChange();
        }
        @Override
        public void onProductConnect(BaseProduct baseProduct) {
            Log.d("TAG", String.format("onProductConnect newProduct:%s", baseProduct));
            notifyStatusChange();

        }
        @Override
        public void onComponentChange(BaseProduct.ComponentKey componentKey, BaseComponent oldComponent,
                                      BaseComponent newComponent) {
            if (newComponent != null) {
                newComponent.setComponentListener(new BaseComponent.ComponentListener() {

                    @Override
                    public void onConnectivityChange(boolean isConnected) {
                        Log.d("TAG", "onComponentConnectivityChanged: " + isConnected);
                        notifyStatusChange();
                    }
                });
            }

            Log.d("TAG",
                    String.format("onComponentChange key:%s, oldComponent:%s, newComponent:%s",
                            componentKey,
                            oldComponent,
                            newComponent));

        }
        @Override
        public void onInitProcess(DJISDKInitEvent djisdkInitEvent, int i) {

        }

        @Override
        public void onDatabaseDownloadProgress(long l, long l1) {

        }
    };

    //Check the permissions before registering the application for android system 6.0 above.
    int permissionCheck = ContextCompat.checkSelfPermission(getApplicationContext(), android.Manifest.permission.WRITE_EXTERNAL_STORAGE);
    int permissionCheck2 = ContextCompat.checkSelfPermission(getApplicationContext(), android.Manifest.permission.READ_PHONE_STATE);
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || (permissionCheck == 0 && permissionCheck2 == 0)) {
        //This is used to start SDK services and initiate SDK.
        DJISDKManager.getInstance().registerApp(getApplicationContext(), mDJISDKManagerCallback);
        Toast.makeText(getApplicationContext(), "registering, pls wait...", Toast.LENGTH_LONG).show();

    } else {
        Toast.makeText(getApplicationContext(), "Please check if the permission is granted.", Toast.LENGTH_LONG).show();
    }
}
~~~

Here, we implement several features:

1. We override the `onCreate()` method to initialize the `mHandler` and `mDJISDKManagerCallback` instance variables and implement their callback methods.

2. For the four interface methods of `SDKManagerCallback`. we use the `onRegister()` method to check the Application registration status and show text message here. When the product is connected or disconnected, the `onProductConnect()` and `onProductDisconnect()` methods will be invoked. Moreover, we use the `onComponentChange()` method to check the component changes and invoke the `notifyStatusChange()` method to notify the changes.

3. Check the permissions of `WRITE_EXTERNAL_STORAGE` and `READ_PHONE_STATE`, then invoke the `registerApp()` method of `DJISDKManager` to register the application.

Now let's build and run the project and install it to your Android device. If everything goes well, you should see the "Register Success" textView like the following screenshot when you register the app successfully.

![registerSuccess](../images/tutorials-and-samples/Android/FPVDemo/registerSuccess.png)

> **Important:** Please initialize the DJI Android SDK class objects inside the `onCreate()` method after the SDK classes are loaded, failing to do so will result in unexpected crashes.

For more details of registering your application, please check this tutorial: [Importing and Activating DJI SDK in Android Studio Project](../application-development-workflow/workflow-integrate.html#Android-Studio-Project-Integration).

## Working on the ConnectionActivity

Once you finish the steps above, let's open the "ConnectionActivity.java" file and create several variables for checking permission and registration above the `onCreate()` method:

~~~java
private static final String[] REQUIRED_PERMISSION_LIST = new String[]{
        Manifest.permission.VIBRATE,
        Manifest.permission.INTERNET,
        Manifest.permission.ACCESS_WIFI_STATE,
        Manifest.permission.WAKE_LOCK,
        Manifest.permission.ACCESS_COARSE_LOCATION,
        Manifest.permission.ACCESS_NETWORK_STATE,
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.CHANGE_WIFI_STATE,
        Manifest.permission.WRITE_EXTERNAL_STORAGE,
        Manifest.permission.BLUETOOTH,
        Manifest.permission.BLUETOOTH_ADMIN,
        Manifest.permission.READ_EXTERNAL_STORAGE,
        Manifest.permission.READ_PHONE_STATE,
};
private List<String> missingPermission = new ArrayList<>();
private AtomicBoolean isRegistrationInProgress = new AtomicBoolean(false);
private static final int REQUEST_PERMISSION_CODE = 12345;
~~~

Next, invoke the `checkAndRequestPermissions()` method in the `onCreate()` method and implement the following methods:

~~~java
@Override
protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    checkAndRequestPermissions();
    setContentView(R.layout.activity_connection);
    initUI();
}

/**
 * Checks if there is any missing permissions, and
 * requests runtime permission if needed.
 */
private void checkAndRequestPermissions() {
    // Check for permissions
    for (String eachPermission : REQUIRED_PERMISSION_LIST) {
        if (ContextCompat.checkSelfPermission(this, eachPermission) != PackageManager.PERMISSION_GRANTED) {
            missingPermission.add(eachPermission);
        }
    }
    // Request for missing permissions
    if (!missingPermission.isEmpty() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        ActivityCompat.requestPermissions(this,
                missingPermission.toArray(new String[missingPermission.size()]),
                REQUEST_PERMISSION_CODE);
    }

}

/**
 * Result of runtime permission request
 */
@Override
public void onRequestPermissionsResult(int requestCode,
                                       @NonNull String[] permissions,
                                       @NonNull int[] grantResults) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    // Check for granted permission and remove from missing list
    if (requestCode == REQUEST_PERMISSION_CODE) {
        for (int i = grantResults.length - 1; i >= 0; i--) {
            if (grantResults[i] == PackageManager.PERMISSION_GRANTED) {
                missingPermission.remove(permissions[i]);
            }
        }
    }
    // If there is enough permission, we will start the registration
    if (missingPermission.isEmpty()) {
        startSDKRegistration();
    } else {
        showToast("Missing permissions!!!");
    }
}

private void startSDKRegistration() {
    if (isRegistrationInProgress.compareAndSet(false, true)) {
        AsyncTask.execute(new Runnable() {
            @Override
            public void run() {
                showToast( "registering, pls wait...");
                DJISDKManager.getInstance().registerApp(getApplicationContext(), new DJISDKManager.SDKManagerCallback() {
                    @Override
                    public void onRegister(DJIError djiError) {
                        if (djiError == DJISDKError.REGISTRATION_SUCCESS) {
                            DJILog.e("App registration", DJISDKError.REGISTRATION_SUCCESS.getDescription());
                            DJISDKManager.getInstance().startConnectionToProduct();
                            showToast("Register Success");
                        } else {
                            showToast( "Register sdk fails, check network is available");
                        }
                        Log.v(TAG, djiError.getDescription());
                    }

                    @Override
                    public void onProductDisconnect() {
                        Log.d(TAG, "onProductDisconnect");
                        showToast("Product Disconnected");

                    }
                    @Override
                    public void onProductConnect(BaseProduct baseProduct) {
                        Log.d(TAG, String.format("onProductConnect newProduct:%s", baseProduct));
                        showToast("Product Connected");

                    }
                    @Override
                    public void onComponentChange(BaseProduct.ComponentKey componentKey, BaseComponent oldComponent,
                                                  BaseComponent newComponent) {

                        if (newComponent != null) {
                            newComponent.setComponentListener(new BaseComponent.ComponentListener() {

                                @Override
                                public void onConnectivityChange(boolean isConnected) {
                                    Log.d(TAG, "onComponentConnectivityChanged: " + isConnected);
                                }
                            });
                        }
                        Log.d(TAG,
                                String.format("onComponentChange key:%s, oldComponent:%s, newComponent:%s",
                                        componentKey,
                                        oldComponent,
                                        newComponent));

                    }
                    @Override
                    public void onInitProcess(DJISDKInitEvent djisdkInitEvent, int i) {

                    }

                    @Override
                    public void onDatabaseDownloadProgress(long l, long l1) {

                    }
                });
            }
        });
    }
}
~~~

In the code shown above, we implement the following features:

1. In the `onCreate()` method, we invoke the `checkAndRequestPermissions()` method to check if there is any missing permissions, and requests runtime permission if needed. Then invoke the `initUI()` methods to initialize the UI elements.

2. Next, override the `onRequestPermissionsResult()` method to check the result of runtime permission request. And then invoke the `startSDKRegistration()` method to register the application.

3. Furthermore, implement the `startSDKRegistration()` method and invoke the `registerApp()` method of `DJISDKManager` to register the application. If the registration is successful, invoke the `startConnectionToProduct()` method of `DJISDKManager` inside the `onRegister()` callback method to start the connection between SDK and the DJI Products.

Once we finish the steps above, continue to add the code at the bottom of the `onCreate()` method:

~~~java
// Register the broadcast receiver for receiving the device connection's changes.
IntentFilter filter = new IntentFilter();
filter.addAction(FPVDemoApplication.FLAG_CONNECTION_CHANGE);
registerReceiver(mReceiver, filter);
~~~

Here, we register the broadcast receiver for receiving the device connection's changes.

Next, add the following methods below the `initUI()` method:

~~~java
protected BroadcastReceiver mReceiver = new BroadcastReceiver() {

    @Override
    public void onReceive(Context context, Intent intent) {
        refreshSDKRelativeUI();
    }
};

@Override
protected void onDestroy() {
    Log.e(TAG, "onDestroy");
    unregisterReceiver(mReceiver);
    super.onDestroy();
}

private void refreshSDKRelativeUI() {
    BaseProduct mProduct = FPVDemoApplication.getProductInstance();

    if (null != mProduct && mProduct.isConnected()) {
        Log.v(TAG, "refreshSDK: True");
        mBtnOpen.setEnabled(true);

        String str = mProduct instanceof Aircraft ? "DJIAircraft" : "DJIHandHeld";
        mTextConnectionStatus.setText("Status: " + str + " connected");

        if (null != mProduct.getModel()) {
            mTextProduct.setText("" + mProduct.getModel().getDisplayName());
        } else {
            mTextProduct.setText(R.string.product_information);
        }

    } else {
        Log.v(TAG, "refreshSDK: False");
        mBtnOpen.setEnabled(false);

        mTextProduct.setText(R.string.product_information);
        mTextConnectionStatus.setText(R.string.connection_loose);
    }
}

~~~

In the code above, we implement the following features:

1. Create the "BroadcastReceiver" and override its `onReceive()` method to invoke the `refreshSDKRelativeUI()` method to refresh the UI elements.

2. We override the `onDestroy()` method and invoke the `unregisterReceiver()` method by passing the `mReceiver` variable to unregister the broadcast receiver.

3. In the `refreshSDKRelativeUI()` method, we check the BaseProduct's connection status by invoking `isConnected()` method. If the product is connected, we enable the `mBtnOpen` button, update the `mTextConnectionStatus`'s text content and update the `mTextProduct`'s content with product name. Otherwise, if the product is disconnected, we disable the `mBtnOpen` button and update the `mTextProduct` and `mTextConnectionStatus` textViews' content.

Finally, let's implement the `onClick()` method of `mBtnOpen` button and the `showToast()` method as shown below:

~~~java
@Override
public void onClick(View v) {
    switch (v.getId()) {

        case R.id.btn_open: {
            Intent intent = new Intent(this, MainActivity.class);
            startActivity(intent);
            break;
        }
        default:
            break;
    }
}

private void showToast(final String toastMsg) {
    runOnUiThread(new Runnable() {
        @Override
        public void run() {
            Toast.makeText(getApplicationContext(), toastMsg, Toast.LENGTH_LONG).show();

        }
    });
}   
~~~

Here, we create an Intent object with the class of `MainActivity` and invoke the `startActivity()` method by passing `intent` object to start the MainActivity.

## Implementing the First Person View

Now, let's open the "MainActivity.java" file and declare the `TAG` and `mReceivedVideoDataListener` variables as shown below:

~~~java
private static final String TAG = MainActivity.class.getName();
protected VideoFeeder.VideoDataListener mReceivedVideoDataListener = null;
~~~

Then update the `onCreate()` method as shown below:

~~~java
@Override
protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_main);
    initUI();

    // The callback for receiving the raw H264 video data for camera live view
    mReceivedVideoDataListener = new VideoFeeder.VideoDataListener() {

        @Override
        public void onReceive(byte[] videoBuffer, int size) {
            if (mCodecManager != null) {
                mCodecManager.sendDataToDecoder(videoBuffer, size);
            }
        }
    };
}
~~~

In the code above, we initialize the `mReceivedVideoDataListener` variable using VideoFeeder's `VideoDataListener()`. Inside the callback, we override its `onReceive()` method to get the raw H264 video data and send them to `mCodecManager` for decoding.  

Next, let's implement the `onProductChange()` method invoke it in the `onResume()` method as shown below:

~~~java
protected void onProductChange() {
    initPreviewer();
}

@Override
public void onResume() {
    Log.e(TAG, "onResume");
    super.onResume();
    initPreviewer();
    onProductChange();

    if(mVideoSurface == null) {
        Log.e(TAG, "mVideoSurface is null");
    }
}
~~~

Furthermore, let's implement two important methods to show and reset the live video stream on our `mVideoSurface` TextureView:

~~~java
private void initPreviewer() {

    BaseProduct product = FPVDemoApplication.getProductInstance();

    if (product == null || !product.isConnected()) {
        showToast(getString(R.string.disconnected));
    } else {
        if (null != mVideoSurface) {
            mVideoSurface.setSurfaceTextureListener(this);
        }
        if (!product.getModel().equals(Model.UNKNOWN_AIRCRAFT)) {
            VideoFeeder.getInstance().getPrimaryVideoFeed().addVideoDataListener(mReceivedVideoDataListener);
        }
    }
}

private void uninitPreviewer() {
    Camera camera = FPVDemoApplication.getCameraInstance();
    if (camera != null){
        // Reset the callback
            VideoFeeder.getInstance().getPrimaryVideoFeed().addVideoDataListener(null);
    }
}
~~~

In the `initPreviewer()` method, firstly, we check the product connection status and invoke the `setSurfaceTextureListener()` method of TextureView to set texture listener to MainActivity. Then check if `VideoFeeder` has video feeds and the video feed's size is larger than 0 and set the `mReceivedVideoDataListener` as its "listener". So once the camera is connected and receive video data, it will show on the `mVideoSurface` TextureView.

Moreover, we implement the `uninitPreviewer()` method to reset Camera's "VideoDataListener" to null.

Now, let's override the four SurfaceTextureListener interface methods as shown below:

~~~java
@Override
public void onSurfaceTextureAvailable(SurfaceTexture surface, int width, int height) {
    Log.e(TAG, "onSurfaceTextureAvailable");
    if (mCodecManager == null) {
        mCodecManager = new DJICodecManager(this, surface, width, height);
    }
}

@Override
public void onSurfaceTextureSizeChanged(SurfaceTexture surface, int width, int height) {
    Log.e(TAG, "onSurfaceTextureSizeChanged");
}

@Override
public boolean onSurfaceTextureDestroyed(SurfaceTexture surface) {
    Log.e(TAG,"onSurfaceTextureDestroyed");
    if (mCodecManager != null) {
        mCodecManager.cleanSurface();
        mCodecManager = null;
    }

    return false;
}

@Override
public void onSurfaceTextureUpdated(SurfaceTexture surface) {
}
~~~

We init the `mCodecManager` variable in the `onSurfaceTextureAvailable()` method, then reset the `mCodecManager` and invoke its `cleanSurface()` method to reset the surface data.

For more detail implementations, please check the Github source code of this tutorial.

## Connecting to the Aircraft or Handheld Device

After you finish the steps above, please check this [Connect Mobile Device and Run Application](../application-development-workflow/workflow-run.html#connect-mobile-device-and-run-application) guide to run the application and view the live video stream from your DJI product's camera based on what we've finished of the application so far!

## Enjoying the First Person View

If you can see the live video stream in the application, congratulations! Let's move forward.

 ![fpv](../images/tutorials-and-samples/Android/FPVDemo/fpv.png)

## Implementing the Capture function

Now, let's override the `onClick()` method to implement the capture button click action:

~~~java
@Override
public void onClick(View v) {

    switch (v.getId()) {
        case R.id.btn_capture:{
            captureAction();
            break;
        }
        default:
            break;
    }
}
~~~

Then declare a `handler` variable and initialize it in the `onCreate()` method as shown below:

~~~java
private Handler handler;
~~~

~~~java
handler = new Handler();
~~~

Next, implement the `captureAction()` method as shown below:

~~~objc
// Method for taking photo
private void captureAction(){

    final Camera camera = FPVDemoApplication.getCameraInstance();
    if (camera != null) {

        SettingsDefinitions.ShootPhotoMode photoMode = SettingsDefinitions.ShootPhotoMode.SINGLE; // Set the camera capture mode as Single mode
        camera.setShootPhotoMode(photoMode, new CommonCallbacks.CompletionCallback(){
                @Override
                public void onResult(DJIError djiError) {
                    if (null == djiError) {
                        handler.postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                camera.startShootPhoto(new CommonCallbacks.CompletionCallback() {
                                    @Override
                                    public void onResult(DJIError djiError) {
                                        if (djiError == null) {
                                            showToast("take photo: success");
                                        } else {
                                            showToast(djiError.getDescription());
                                        }
                                    }
                                });
                            }
                        }, 2000);
                    }
                }
        });
    }
}
~~~

In the code above, firstly, we create a "ShootPhotoMode" variable and assign "ShootPhotoMode.SINGLE" to it. Then invoke the `setShootPhotoMode()` method of Camera to set the shoot photo mode. The camera shoot photo mode has several modes within its definition. You can use "AEB", "BURST", "HDR", etc for "ShootPhotoMode", for more details, please check **SettingsDefinitions.ShootPhotoMode**.

Next, implement the `startShootPhoto()` method of Camera inside the completion callback of `setShootPhotoMode` method to control the camera to shoot photo. Here, we invoke the `postDelayed()` method of `Handler` to delay the method execution for 2000 milliseconds since the camera need time to execute the `setShootPhotoMode` command.

Finally, we override its `onResult()` method of `startShootPhoto()` to get the result and show the related texts to users.

  Build and run your project and then try the shoot photo function. If the screen flashes after your press the **Capture** button, your capture function should work now.

## Implementing the Record function

### Switching Camera Mode

Before we go ahead to implement the record action method, let's implement the switch Camera Mode feature. Improve the `onClick()` method by adding button click actions for `mShootPhotoModeBtn` and `mRecordVideoModeBtn` as follows:

~~~java
@Override
public void onClick(View v) {

    switch (v.getId()) {
        case R.id.btn_capture:{
            captureAction();
            break;
        }
        case R.id.btn_shoot_photo_mode:{
            switchCameraMode(SettingsDefinitions.CameraMode.SHOOT_PHOTO);
            break;
        }
        case R.id.btn_record_video_mode:{
            switchCameraMode(SettingsDefinitions.CameraMode.RECORD_VIDEO);
            break;
        }
        default:
            break;
    }
}
~~~

Next, implement the `switchCameraMode()` method:

~~~java
private void switchCameraMode(SettingsDefinitions.CameraMode cameraMode){

    Camera camera = FPVDemoApplication.getCameraInstance();
    if (camera != null) {
        camera.setMode(cameraMode, new CommonCallbacks.CompletionCallback() {
            @Override
            public void onResult(DJIError error) {

                if (error == null) {
                    showToast("Switch Camera Mode Succeeded");
                } else {
                    showToast(error.getDescription());
                }
            }
        });
        }
}
~~~

In the code above, we invoke the `setMode()` method of Camera and assign the `cameraMode ` parameter to it. Then override the `onResult()` method to show the change camera mode result to the users.

### Working on the Record Action

Once we finish the switch camera mode feature, we can now implement the record feature. Let's improve the `initUI()` method by add the following code at the bottom of it:

~~~java
mRecordBtn.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
    @Override
    public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
        if (isChecked) {
            recordingTime.setVisibility(View.VISIBLE);
            startRecord();

        } else {
            recordingTime.setVisibility(View.INVISIBLE);
            stopRecord();
        }
    }
});
~~~

Here, we implement the `setOnCheckedChangeListener()` method of ToggleButton `mRecordBtn` and override its `onCheckedChanged()` method to check the `isChecked` variable value, which means the toggle state of the button, and invoke the `startRecord()` and `stopRecord()` methods relatively.

Next, implement the `startRecord()` and `stopRecord()` methods as shown below:

~~~java
// Method for starting recording
private void startRecord(){

    final Camera camera = FPVDemoApplication.getCameraInstance();
    if (camera != null) {
        camera.startRecordVideo(new CommonCallbacks.CompletionCallback(){
            @Override
            public void onResult(DJIError djiError)
            {
                if (djiError == null) {
                    showToast("Record video: success");
                }else {
                    showToast(djiError.getDescription());
                }
            }
        }); // Execute the startRecordVideo API
    }
}

// Method for stopping recording
private void stopRecord(){

    Camera camera = FPVDemoApplication.getCameraInstance();
    if (camera != null) {
        camera.stopRecordVideo(new CommonCallbacks.CompletionCallback(){

            @Override
            public void onResult(DJIError djiError)
            {
                if(djiError == null) {
                    showToast("Stop recording: success");
                }else {
                    showToast(djiError.getDescription());
                }
            }
        }); // Execute the stopRecordVideo API
    }

}
~~~

In the code above, we invoke the `startRecordVideo()` and `stopRecordVideo()` methods of Camera to implement the start record and stop record features. And show the result messages to our user by overriding the `onResult()` methods.

Lastly, when the video starts recording, we should show the recording time info to our users. So let's add the following code to the bottom of `onCreate()` method as follows:

~~~java
Camera camera = FPVDemoApplication.getCameraInstance();

if (camera != null) {

    camera.setSystemStateCallback(new SystemState.Callback() {
        @Override
        public void onUpdate(SystemState cameraSystemState) {
            if (null != cameraSystemState) {

                int recordTime = cameraSystemState.getCurrentVideoRecordingTimeInSeconds();
                int minutes = (recordTime % 3600) / 60;
                int seconds = recordTime % 60;

                final String timeString = String.format("%02d:%02d", minutes, seconds);
                final boolean isVideoRecording = cameraSystemState.isRecording();

                MainActivity.this.runOnUiThread(new Runnable() {

                    @Override
                    public void run() {

                        recordingTime.setText(timeString);

                        /*
                         * Update recordingTime TextView visibility and mRecordBtn's check state
                         */
                        if (isVideoRecording){
                            recordingTime.setVisibility(View.VISIBLE);
                        }else
                        {
                            recordingTime.setVisibility(View.INVISIBLE);
                        }
                    }
                });
            }
        }
    });

}
~~~

Here, we implement the `setSystemStateCallback()` of Camera and override the `onUpdate()` method to get the current camera system state, we can call the `getCurrentVideoRecordingTimeInSeconds()` method of "SystemState" to get the record time info. Before we show the record time info to our users, we should convert it from seconds to "00:00" format including minutes and seconds. Lastly, we update the TextView `recordingTime` variable's text value with the latest record time info and update the visibility of `recordingTime` TextView in UI Thread.

For more details, please check the Github source code of this tutorial.

Now, let's build and run the project and check the functions. Here we use Mavic Pro as an example. You can try to play with the **Capture**, **Record** and **Switch Camera WorkMode** functions, here is a gif animation to demo these three functions:

  ![demoAni](../images/tutorials-and-samples/Android/FPVDemo/demoAni.gif)

  Congratulations! Your Aerial FPV android app is complete, you can now use this app to control the camera of your DJI Product now.

### Summary

   In this tutorial, you’ve learned how to use DJI Mobile SDK to show the FPV View from the aircraft's camera and control the camera of DJI's Aircraft to shoot photo and record video. These are the most basic and common features in a typical drone mobile app: **Capture** and **Record**. However, if you want to create a drone app which is more fancy, you still have a long way to go. More advanced features should be implemented, including previewing the photo and video in the SD Card, showing the OSD data of the aircraft and so on. Hope you enjoy this tutorial, and stay tuned for our next one!
