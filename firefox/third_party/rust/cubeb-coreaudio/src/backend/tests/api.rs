use super::utils::{
    test_audiounit_get_buffer_frame_size, test_audiounit_scope_is_enabled, test_create_audiounit,
    test_device_channels_in_scope, test_device_in_scope, test_get_all_devices,
    test_get_default_audiounit, test_get_default_device, test_get_default_raw_stream,
    test_get_devices_in_scope, test_get_raw_context, ComponentSubType, DeviceFilter, PropertyScope,
    Scope,
};
use super::*;

// make_sized_audio_channel_layout
// ------------------------------------
#[test]
fn test_make_sized_audio_channel_layout() {
    for channels in 1..10 {
        let size = mem::size_of::<AudioChannelLayout>()
            + (channels - 1) * mem::size_of::<AudioChannelDescription>();
        let _ = make_sized_audio_channel_layout(size);
    }
}

#[test]
#[should_panic]
fn test_make_sized_audio_channel_layout_with_wrong_size() {
    // let _ = make_sized_audio_channel_layout(0);
    let one_channel_size = mem::size_of::<AudioChannelLayout>();
    let padding_size = 10;
    assert_ne!(mem::size_of::<AudioChannelDescription>(), padding_size);
    let wrong_size = one_channel_size + padding_size;
    let _ = make_sized_audio_channel_layout(wrong_size);
}

// active_streams
// update_latency_by_adding_stream
// update_latency_by_removing_stream
// ------------------------------------
#[test]
fn test_increase_and_decrease_context_streams() {
    use std::thread;
    const STREAMS: u32 = 10;

    let context = AudioUnitContext::new();
    let context_ptr_value = &context as *const AudioUnitContext as usize;

    let mut join_handles = vec![];
    for i in 0..STREAMS {
        join_handles.push(thread::spawn(move || {
            let context = unsafe { &*(context_ptr_value as *const AudioUnitContext) };

            context.update_latency_by_adding_stream(i)
        }));
    }
    let mut latencies = vec![];
    for handle in join_handles {
        latencies.push(handle.join().unwrap());
    }
    assert_eq!(context.active_streams(), STREAMS);
    check_streams(&context, STREAMS);

    check_latency(&context, Some(latencies[0]));
    for i in 0..latencies.len() - 1 {
        assert_eq!(latencies[i], latencies[i + 1]);
    }

    let mut join_handles = vec![];
    for _ in 0..STREAMS {
        join_handles.push(thread::spawn(move || {
            let context = unsafe { &*(context_ptr_value as *const AudioUnitContext) };
            context.update_latency_by_removing_stream();
        }));
    }
    for handle in join_handles {
        let _ = handle.join();
    }
    check_streams(&context, 0);

    check_latency(&context, None);
}

fn check_streams(context: &AudioUnitContext, number: u32) {
    let guard = context.latency_controller.lock().unwrap();
    assert_eq!(guard.streams, number);
}

fn check_latency(context: &AudioUnitContext, latency: Option<u32>) {
    let guard = context.latency_controller.lock().unwrap();
    assert_eq!(guard.latency, latency);
}

// make_silent
// ------------------------------------
#[test]
fn test_make_silent() {
    let mut array = allocate_array::<u32>(10);
    for data in array.iter_mut() {
        *data = 0xFFFF;
    }

    let mut buffer = AudioBuffer::default();
    buffer.mData = array.as_mut_ptr() as *mut c_void;
    buffer.mDataByteSize = (array.len() * mem::size_of::<u32>()) as u32;
    buffer.mNumberChannels = 1;

    audiounit_make_silent(&mut buffer);
    for data in array {
        assert_eq!(data, 0);
    }
}

// minimum_resampling_input_frames
// ------------------------------------
#[test]
fn test_minimum_resampling_input_frames() {
    let input_rate = 48000_f64;
    let output_rate = 44100_f64;

    let frames = 100;
    let times = input_rate / output_rate;
    let expected = (frames as f64 * times).ceil() as usize;

    assert_eq!(
        minimum_resampling_input_frames(input_rate, output_rate, frames),
        expected
    );
}

#[test]
#[should_panic]
fn test_minimum_resampling_input_frames_zero_input_rate() {
    minimum_resampling_input_frames(0_f64, 44100_f64, 1);
}

#[test]
#[should_panic]
fn test_minimum_resampling_input_frames_zero_output_rate() {
    minimum_resampling_input_frames(48000_f64, 0_f64, 1);
}

#[test]
fn test_minimum_resampling_input_frames_equal_input_output_rate() {
    let frames = 100;
    assert_eq!(
        minimum_resampling_input_frames(44100_f64, 44100_f64, frames),
        frames
    );
}

// create_device_info
// ------------------------------------
#[test]
fn test_create_device_info_from_unknown_input_device() {
    if let Some(default_device_id) = test_get_default_device(Scope::Input) {
        let default_device =
            run_serially(|| create_device_info(kAudioObjectUnknown, DeviceType::INPUT).unwrap());
        assert_eq!(default_device.id, default_device_id);
        assert_eq!(
            default_device.flags,
            device_flags::DEV_INPUT | device_flags::DEV_SELECTED_DEFAULT
        );
    } else {
        println!("No input device to perform test.");
    }
}

#[test]
fn test_create_device_info_from_unknown_output_device() {
    if let Some(default_device_id) = test_get_default_device(Scope::Output) {
        let default_device =
            run_serially(|| create_device_info(kAudioObjectUnknown, DeviceType::OUTPUT)).unwrap();
        assert_eq!(default_device.id, default_device_id);
        assert_eq!(
            default_device.flags,
            device_flags::DEV_OUTPUT | device_flags::DEV_SELECTED_DEFAULT
        );
    } else {
        println!("No output device to perform test.");
    }
}

#[test]
#[should_panic]
fn test_set_device_info_to_system_input_device() {
    let _device = run_serially_forward_panics(|| {
        create_device_info(kAudioObjectSystemObject, DeviceType::INPUT)
    });
}

#[test]
#[should_panic]
fn test_set_device_info_to_system_output_device() {
    let _device = run_serially_forward_panics(|| {
        create_device_info(kAudioObjectSystemObject, DeviceType::OUTPUT)
    });
}

// FIXME: Is it ok to set input device to a nonexistent device ?
#[ignore]
#[test]
#[should_panic]
fn test_set_device_info_to_nonexistent_input_device() {
    let nonexistent_id = std::u32::MAX;
    let _device =
        run_serially_forward_panics(|| create_device_info(nonexistent_id, DeviceType::INPUT));
}

// FIXME: Is it ok to set output device to a nonexistent device ?
#[ignore]
#[test]
#[should_panic]
fn test_set_device_info_to_nonexistent_output_device() {
    let nonexistent_id = std::u32::MAX;
    let _device =
        run_serially_forward_panics(|| create_device_info(nonexistent_id, DeviceType::OUTPUT));
}

// add_listener (for default output device)
// ------------------------------------
#[test]
fn test_add_listener_unknown_device() {
    extern "C" fn callback(
        _id: AudioObjectID,
        _number_of_addresses: u32,
        _addresses: *const AudioObjectPropertyAddress,
        _data: *mut c_void,
    ) -> OSStatus {
        assert!(false, "Should not be called.");
        kAudioHardwareUnspecifiedError as OSStatus
    }

    test_get_default_raw_stream(|stream| {
        let listener = device_property_listener::new(
            kAudioObjectUnknown,
            get_property_address(
                Property::HardwareDefaultOutputDevice,
                DeviceType::INPUT | DeviceType::OUTPUT,
            ),
            callback,
        );
        let res = stream
            .queue
            .run_sync(|| stream.add_device_listener(&listener))
            .unwrap();
        assert_eq!(res, kAudioHardwareBadObjectError as OSStatus);
    });
}

// remove_listener (for default output device)
// ------------------------------------
#[test]
fn test_add_listener_then_remove_system_device() {
    extern "C" fn callback(
        _id: AudioObjectID,
        _number_of_addresses: u32,
        _addresses: *const AudioObjectPropertyAddress,
        _data: *mut c_void,
    ) -> OSStatus {
        assert!(false, "Should not be called.");
        kAudioHardwareUnspecifiedError as OSStatus
    }

    test_get_default_raw_stream(|stream| {
        let listener = device_property_listener::new(
            kAudioObjectSystemObject,
            get_property_address(
                Property::HardwareDefaultOutputDevice,
                DeviceType::INPUT | DeviceType::OUTPUT,
            ),
            callback,
        );
        let res = stream
            .queue
            .run_sync(|| stream.add_device_listener(&listener))
            .unwrap();
        assert_eq!(res, NO_ERR);
        let res = stream
            .queue
            .run_sync(|| stream.remove_device_listener(&listener))
            .unwrap();
        assert_eq!(res, NO_ERR);
    });
}

#[test]
fn test_remove_listener_without_adding_any_listener_before_system_device() {
    extern "C" fn callback(
        _id: AudioObjectID,
        _number_of_addresses: u32,
        _addresses: *const AudioObjectPropertyAddress,
        _data: *mut c_void,
    ) -> OSStatus {
        assert!(false, "Should not be called.");
        kAudioHardwareUnspecifiedError as OSStatus
    }

    test_get_default_raw_stream(|stream| {
        let listener = device_property_listener::new(
            kAudioObjectSystemObject,
            get_property_address(
                Property::HardwareDefaultOutputDevice,
                DeviceType::INPUT | DeviceType::OUTPUT,
            ),
            callback,
        );
        let res = stream
            .queue
            .run_sync(|| stream.remove_device_listener(&listener))
            .unwrap();
        assert_eq!(res, NO_ERR);
    });
}

#[test]
fn test_remove_listener_unknown_device() {
    extern "C" fn callback(
        _id: AudioObjectID,
        _number_of_addresses: u32,
        _addresses: *const AudioObjectPropertyAddress,
        _data: *mut c_void,
    ) -> OSStatus {
        assert!(false, "Should not be called.");
        kAudioHardwareUnspecifiedError as OSStatus
    }

    test_get_default_raw_stream(|stream| {
        let listener = device_property_listener::new(
            kAudioObjectUnknown,
            get_property_address(
                Property::HardwareDefaultOutputDevice,
                DeviceType::INPUT | DeviceType::OUTPUT,
            ),
            callback,
        );
        let res = stream
            .queue
            .run_sync(|| stream.remove_device_listener(&listener))
            .unwrap();
        assert_eq!(res, kAudioHardwareBadObjectError as OSStatus);
    });
}

// get_default_device_id
// ------------------------------------
#[test]
fn test_get_default_device_id() {
    if test_get_default_device(Scope::Input).is_some() {
        assert_ne!(
            run_serially(|| get_default_device_id(DeviceType::INPUT)).unwrap(),
            kAudioObjectUnknown,
        );
    }

    if test_get_default_device(Scope::Output).is_some() {
        assert_ne!(
            run_serially(|| get_default_device_id(DeviceType::OUTPUT)).unwrap(),
            kAudioObjectUnknown,
        );
    }
}

#[test]
#[should_panic]
fn test_get_default_device_id_with_unknown_type() {
    assert!(run_serially_forward_panics(|| get_default_device_id(DeviceType::UNKNOWN)).is_err());
}

#[test]
#[should_panic]
fn test_get_default_device_id_with_inout_type() {
    assert!(run_serially_forward_panics(|| get_default_device_id(
        DeviceType::INPUT | DeviceType::OUTPUT
    ))
    .is_err());
}

// convert_channel_layout
// ------------------------------------
#[test]
fn test_convert_channel_layout() {
    let pairs = [
        (
            vec![kAudioChannelLabel_Mono],
            vec![mixer::Channel::FrontCenter],
        ),
        (
            vec![kAudioChannelLabel_Mono, kAudioChannelLabel_LFEScreen],
            vec![mixer::Channel::FrontCenter, mixer::Channel::LowFrequency],
        ),
        (
            vec![kAudioChannelLabel_Left, kAudioChannelLabel_Right],
            vec![mixer::Channel::FrontLeft, mixer::Channel::FrontRight],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_Unknown,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::Discrete,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_Unused,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::Silence,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_ForeignLanguage,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::Silence,
            ],
        ),
        // The SMPTE layouts.
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_LFEScreen,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::LowFrequency,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_Center,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::FrontCenter,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_Center,
                kAudioChannelLabel_LFEScreen,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::FrontCenter,
                mixer::Channel::LowFrequency,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_CenterSurround,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::BackCenter,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_CenterSurround,
                kAudioChannelLabel_LFEScreen,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::BackCenter,
                mixer::Channel::LowFrequency,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_Center,
                kAudioChannelLabel_CenterSurround,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::FrontCenter,
                mixer::Channel::BackCenter,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_Center,
                kAudioChannelLabel_CenterSurround,
                kAudioChannelLabel_LFEScreen,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::FrontCenter,
                mixer::Channel::BackCenter,
                mixer::Channel::LowFrequency,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_LeftSurroundDirect,
                kAudioChannelLabel_RightSurroundDirect,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::SideLeft,
                mixer::Channel::SideRight,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_LeftSurroundDirect,
                kAudioChannelLabel_RightSurroundDirect,
                kAudioChannelLabel_LFEScreen,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::SideLeft,
                mixer::Channel::SideRight,
                mixer::Channel::LowFrequency,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_LeftSurround,
                kAudioChannelLabel_RightSurround,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::BackLeft,
                mixer::Channel::BackRight,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_LeftSurround,
                kAudioChannelLabel_RightSurround,
                kAudioChannelLabel_LFEScreen,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::BackLeft,
                mixer::Channel::BackRight,
                mixer::Channel::LowFrequency,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_Center,
                kAudioChannelLabel_LeftSurroundDirect,
                kAudioChannelLabel_RightSurroundDirect,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::FrontCenter,
                mixer::Channel::SideLeft,
                mixer::Channel::SideRight,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_Center,
                kAudioChannelLabel_LeftSurroundDirect,
                kAudioChannelLabel_RightSurroundDirect,
                kAudioChannelLabel_LFEScreen,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::FrontCenter,
                mixer::Channel::SideLeft,
                mixer::Channel::SideRight,
                mixer::Channel::LowFrequency,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_LeftSurround,
                kAudioChannelLabel_RightSurround,
                kAudioChannelLabel_Center,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::BackLeft,
                mixer::Channel::BackRight,
                mixer::Channel::FrontCenter,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_LeftSurround,
                kAudioChannelLabel_RightSurround,
                kAudioChannelLabel_Center,
                kAudioChannelLabel_LFEScreen,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::BackLeft,
                mixer::Channel::BackRight,
                mixer::Channel::FrontCenter,
                mixer::Channel::LowFrequency,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_Center,
                kAudioChannelLabel_LFEScreen,
                kAudioChannelLabel_CenterSurround,
                kAudioChannelLabel_LeftSurroundDirect,
                kAudioChannelLabel_RightSurroundDirect,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::FrontCenter,
                mixer::Channel::LowFrequency,
                mixer::Channel::BackCenter,
                mixer::Channel::SideLeft,
                mixer::Channel::SideRight,
            ],
        ),
        (
            vec![
                kAudioChannelLabel_Left,
                kAudioChannelLabel_Right,
                kAudioChannelLabel_Center,
                kAudioChannelLabel_LFEScreen,
                kAudioChannelLabel_LeftSurround,
                kAudioChannelLabel_RightSurround,
                kAudioChannelLabel_LeftSurroundDirect,
                kAudioChannelLabel_RightSurroundDirect,
            ],
            vec![
                mixer::Channel::FrontLeft,
                mixer::Channel::FrontRight,
                mixer::Channel::FrontCenter,
                mixer::Channel::LowFrequency,
                mixer::Channel::BackLeft,
                mixer::Channel::BackRight,
                mixer::Channel::SideLeft,
                mixer::Channel::SideRight,
            ],
        ),
    ];

    const MAX_CHANNELS: usize = 10;
    // A Rust mapping structure of the AudioChannelLayout with MAX_CHANNELS channels
    // https://github.com/phracker/MacOSX-SDKs/blob/master/MacOSX10.13.sdk/System/Library/Frameworks/CoreAudio.framework/Versions/A/Headers/CoreAudioTypes.h#L1332
    #[repr(C)]
    struct TestLayout {
        tag: AudioChannelLayoutTag,
        map: AudioChannelBitmap,
        number_channel_descriptions: UInt32,
        channel_descriptions: [AudioChannelDescription; MAX_CHANNELS],
    }

    impl Default for TestLayout {
        fn default() -> Self {
            Self {
                tag: AudioChannelLayoutTag::default(),
                map: AudioChannelBitmap::default(),
                number_channel_descriptions: UInt32::default(),
                channel_descriptions: [AudioChannelDescription::default(); MAX_CHANNELS],
            }
        }
    }

    let mut layout = TestLayout::default();
    layout.tag = kAudioChannelLayoutTag_UseChannelDescriptions;

    for (labels, expected_layout) in pairs.iter() {
        assert!(labels.len() <= MAX_CHANNELS);
        layout.number_channel_descriptions = labels.len() as u32;
        for (idx, label) in labels.iter().enumerate() {
            layout.channel_descriptions[idx].mChannelLabel = *label;
        }
        let layout_ref = unsafe { &(*(&layout as *const TestLayout as *const AudioChannelLayout)) };
        assert_eq!(
            &audiounit_convert_channel_layout(layout_ref).unwrap(),
            expected_layout
        );
    }
}

// get_preferred_channel_layout
// ------------------------------------
#[test]
fn test_get_preferred_channel_layout_output() {
    match test_get_default_audiounit(Scope::Output) {
        Some(unit) => assert!(!run_serially(|| audiounit_get_preferred_channel_layout(
            unit.get_inner()
        ))
        .unwrap()
        .is_empty()),
        None => println!("No output audiounit for test."),
    }
}

// get_current_channel_layout
// ------------------------------------
#[test]
fn test_get_current_channel_layout_output() {
    match test_get_default_audiounit(Scope::Output) {
        Some(unit) => {
            assert!(
                !run_serially_forward_panics(|| audiounit_get_current_channel_layout(
                    unit.get_inner()
                ))
                .unwrap()
                .is_empty()
            )
        }
        None => println!("No output audiounit for test."),
    }
}

// create_stream_description
// ------------------------------------
#[test]
fn test_create_stream_description() {
    let mut channels = 0;
    for (bits, format, flags) in [
        (
            16_u32,
            ffi::CUBEB_SAMPLE_S16LE,
            kAudioFormatFlagIsSignedInteger,
        ),
        (
            16_u32,
            ffi::CUBEB_SAMPLE_S16BE,
            kAudioFormatFlagIsSignedInteger | kAudioFormatFlagIsBigEndian,
        ),
        (32_u32, ffi::CUBEB_SAMPLE_FLOAT32LE, kAudioFormatFlagIsFloat),
        (
            32_u32,
            ffi::CUBEB_SAMPLE_FLOAT32BE,
            kAudioFormatFlagIsFloat | kAudioFormatFlagIsBigEndian,
        ),
    ]
    .iter()
    {
        let bytes = bits / 8;
        channels += 1;

        let mut raw = ffi::cubeb_stream_params::default();
        raw.format = *format;
        raw.rate = 48_000;
        raw.channels = channels;
        raw.layout = ffi::CUBEB_LAYOUT_UNDEFINED;
        raw.prefs = ffi::CUBEB_STREAM_PREF_NONE;
        let params = StreamParams::from(raw);
        let description = create_stream_description(&params).unwrap();
        assert_eq!(description.mFormatID, kAudioFormatLinearPCM);
        assert_eq!(
            description.mFormatFlags,
            flags | kLinearPCMFormatFlagIsPacked
        );
        assert_eq!(description.mSampleRate as u32, raw.rate);
        assert_eq!(description.mChannelsPerFrame, raw.channels);
        assert_eq!(description.mBytesPerFrame, bytes * raw.channels);
        assert_eq!(description.mFramesPerPacket, 1);
        assert_eq!(description.mBytesPerPacket, bytes * raw.channels);
        assert_eq!(description.mReserved, 0);
    }
}

// create_blank_audiounit
// ------------------------------------
#[test]
fn test_create_blank_audiounit() {
    let unit = create_blank_audiounit().unwrap();
    assert!(!unit.is_null());
    // Destroy the AudioUnit
    unsafe {
        AudioUnitUninitialize(unit);
        AudioComponentInstanceDispose(unit);
    }
}

// enable_audiounit_scope
// ------------------------------------
#[test]
fn test_enable_audiounit_scope() {
    // It's ok to enable and disable the scopes of input or output
    // for the unit whose subtype is kAudioUnitSubType_HALOutput
    // even when there is no available input or output devices.
    if let Some(unit) = test_create_audiounit(ComponentSubType::HALOutput) {
        assert!(run_serially_forward_panics(|| enable_audiounit_scope(
            unit.get_inner(),
            DeviceType::OUTPUT,
            true
        ))
        .is_ok());
        assert!(run_serially_forward_panics(|| enable_audiounit_scope(
            unit.get_inner(),
            DeviceType::OUTPUT,
            false
        ))
        .is_ok());
        assert!(run_serially_forward_panics(|| enable_audiounit_scope(
            unit.get_inner(),
            DeviceType::INPUT,
            true
        ))
        .is_ok());
        assert!(run_serially_forward_panics(|| enable_audiounit_scope(
            unit.get_inner(),
            DeviceType::INPUT,
            false
        ))
        .is_ok());
    } else {
        println!("No audiounit to perform test.");
    }
}

#[test]
fn test_enable_audiounit_scope_for_default_output_unit() {
    if let Some(unit) = test_create_audiounit(ComponentSubType::DefaultOutput) {
        assert_eq!(
            run_serially(|| enable_audiounit_scope(unit.get_inner(), DeviceType::OUTPUT, true))
                .unwrap_err(),
            kAudioUnitErr_InvalidProperty
        );
        assert_eq!(
            run_serially(|| enable_audiounit_scope(unit.get_inner(), DeviceType::OUTPUT, false))
                .unwrap_err(),
            kAudioUnitErr_InvalidProperty
        );
        assert_eq!(
            run_serially(|| enable_audiounit_scope(unit.get_inner(), DeviceType::INPUT, true))
                .unwrap_err(),
            kAudioUnitErr_InvalidProperty
        );
        assert_eq!(
            run_serially(|| enable_audiounit_scope(unit.get_inner(), DeviceType::INPUT, false))
                .unwrap_err(),
            kAudioUnitErr_InvalidProperty
        );
    }
}

#[test]
#[should_panic]
fn test_enable_audiounit_scope_with_null_unit() {
    let unit: AudioUnit = ptr::null_mut();
    assert!(
        run_serially_forward_panics(|| enable_audiounit_scope(unit, DeviceType::INPUT, false))
            .is_err()
    );
}

// create_audiounit
// ------------------------------------
#[test]
fn test_for_create_audiounit() {
    let flags_list = [device_flags::DEV_INPUT, device_flags::DEV_OUTPUT];

    let default_input = test_get_default_device(Scope::Input);
    let default_output = test_get_default_device(Scope::Output);

    for flags in flags_list.iter() {
        let mut device = device_info::default();
        device.flags |= *flags;

        // Check the output scope is enabled.
        if device.flags.contains(device_flags::DEV_OUTPUT) && default_output.is_some() {
            device.id = default_output.unwrap();
            let unit = run_serially(|| create_audiounit(&device).unwrap());
            assert!(!unit.is_null());
            assert!(test_audiounit_scope_is_enabled(unit, Scope::Output));

            // Destroy the AudioUnit.
            run_serially(|| unsafe {
                AudioUnitUninitialize(unit);
                AudioComponentInstanceDispose(unit);
            });
        }

        // Check the input scope is enabled.
        if device.flags.contains(device_flags::DEV_INPUT) && default_input.is_some() {
            let device_id = default_input.unwrap();
            device.id = device_id;
            let unit = run_serially(|| create_audiounit(&device).unwrap());
            assert!(!unit.is_null());
            assert!(test_audiounit_scope_is_enabled(unit, Scope::Input));
            // Destroy the AudioUnit.
            run_serially(|| unsafe {
                AudioUnitUninitialize(unit);
                AudioComponentInstanceDispose(unit);
            });
        }
    }
}

#[test]
#[should_panic]
fn test_create_audiounit_with_unknown_scope() {
    let device = device_info::default();
    let _unit = run_serially_forward_panics(|| create_audiounit(&device));
}

// set_buffer_size_sync
// ------------------------------------
#[test]
fn test_set_buffer_size_sync() {
    test_set_buffer_size_by_scope(Scope::Input);
    test_set_buffer_size_by_scope(Scope::Output);
    fn test_set_buffer_size_by_scope(scope: Scope) {
        let unit = test_get_default_audiounit(scope.clone());
        if unit.is_none() {
            println!("No audiounit for {:?}.", scope);
            return;
        }
        let unit = unit.unwrap();
        let prop_scope = match scope {
            Scope::Input => PropertyScope::Output,
            Scope::Output => PropertyScope::Input,
        };
        let mut buffer_frames = test_audiounit_get_buffer_frame_size(
            unit.get_inner(),
            scope.clone(),
            prop_scope.clone(),
        )
        .unwrap();
        assert_ne!(buffer_frames, 0);
        buffer_frames *= 2;
        assert!(run_serially(|| set_buffer_size_sync(
            unit.get_inner(),
            scope.clone().into(),
            buffer_frames
        ))
        .is_ok());
        let new_buffer_frames =
            test_audiounit_get_buffer_frame_size(unit.get_inner(), scope.clone(), prop_scope)
                .unwrap();
        assert_eq!(buffer_frames, new_buffer_frames);
    }
}

#[test]
#[should_panic]
fn test_set_buffer_size_sync_for_input_with_null_input_unit() {
    test_set_buffer_size_sync_by_scope_with_null_unit(Scope::Input);
}

#[test]
#[should_panic]
fn test_set_buffer_size_sync_for_output_with_null_output_unit() {
    test_set_buffer_size_sync_by_scope_with_null_unit(Scope::Output);
}

fn test_set_buffer_size_sync_by_scope_with_null_unit(scope: Scope) {
    let unit: AudioUnit = ptr::null_mut();
    assert!(
        run_serially_forward_panics(|| set_buffer_size_sync(unit, scope.into(), 2048)).is_err()
    );
}

// get_volume, set_volume
// ------------------------------------
#[test]
fn test_stream_get_volume() {
    if let Some(unit) = test_get_default_audiounit(Scope::Output) {
        let expected_volume: f32 = 0.5;
        run_serially(|| set_volume(unit.get_inner(), expected_volume));
        assert_eq!(
            expected_volume,
            run_serially(|| get_volume(unit.get_inner()).unwrap())
        );
    } else {
        println!("No output audiounit.");
    }
}

// convert_uint32_into_string
// ------------------------------------
#[test]
fn test_convert_uint32_into_string() {
    let empty = convert_uint32_into_string(0);
    assert_eq!(empty, CString::default());

    let data: u32 = ('R' as u32) << 24 | ('U' as u32) << 16 | ('S' as u32) << 8 | 'T' as u32;
    let data_string = convert_uint32_into_string(data);
    assert_eq!(data_string, CString::new("RUST").unwrap());
}

// get_channel_count
// ------------------------------------
#[test]
fn test_get_channel_count() {
    test_channel_count(Scope::Input);
    test_channel_count(Scope::Output);

    fn test_channel_count(scope: Scope) {
        if let Some(device) = test_get_default_device(scope.clone()) {
            let channels =
                run_serially(|| get_channel_count(device, DeviceType::from(scope.clone())))
                    .unwrap();
            assert!(channels > 0);
            assert_eq!(
                channels,
                test_device_channels_in_scope(device, scope).unwrap()
            );
        } else {
            println!("No device for {:?}.", scope);
        }
    }
}

#[test]
fn test_get_channel_count_of_input_for_a_output_only_deivce() {
    let devices = test_get_devices_in_scope(Scope::Output);
    for device in devices {
        // Skip in-out devices.
        if test_device_in_scope(device, Scope::Input) {
            continue;
        }
        let count = run_serially(|| get_channel_count(device, DeviceType::INPUT)).unwrap();
        assert_eq!(count, 0);
    }
}

#[test]
fn test_get_channel_count_of_output_for_a_input_only_deivce() {
    let devices = test_get_devices_in_scope(Scope::Input);
    for device in devices {
        // Skip in-out devices.
        if test_device_in_scope(device, Scope::Output) {
            continue;
        }
        let count = run_serially(|| get_channel_count(device, DeviceType::OUTPUT)).unwrap();
        assert_eq!(count, 0);
    }
}

#[test]
#[should_panic]
fn test_get_channel_count_of_unknown_device() {
    assert!(run_serially_forward_panics(|| get_channel_count(
        kAudioObjectUnknown,
        DeviceType::OUTPUT
    ))
    .is_err());
}

#[test]
fn test_get_channel_count_of_inout_type() {
    test_channel_count(Scope::Input);
    test_channel_count(Scope::Output);

    fn test_channel_count(scope: Scope) {
        if let Some(device) = test_get_default_device(scope.clone()) {
            run_serially_forward_panics(|| {
                assert_eq!(
                    get_channel_count(device, DeviceType::INPUT | DeviceType::OUTPUT),
                    get_channel_count(device, DeviceType::INPUT).map(|c| c + get_channel_count(
                        device,
                        DeviceType::OUTPUT
                    )
                    .unwrap_or(0))
                );
            });
        } else {
            println!("No device for {:?}.", scope);
        }
    }
}

#[test]
#[should_panic]
fn test_get_channel_count_of_unknwon_type() {
    test_channel_count(Scope::Input);
    test_channel_count(Scope::Output);

    fn test_channel_count(scope: Scope) {
        if let Some(device) = test_get_default_device(scope.clone()) {
            assert!(get_channel_count(device, DeviceType::UNKNOWN).is_err());
        } else {
            panic!("Panic by default: No device for {:?}.", scope);
        }
    }
}

// get_range_of_sample_rates
// ------------------------------------
#[test]
fn test_get_range_of_sample_rates() {
    test_get_range_of_sample_rates_in_scope(Scope::Input);
    test_get_range_of_sample_rates_in_scope(Scope::Output);

    fn test_get_range_of_sample_rates_in_scope(scope: Scope) {
        if let Some(device) = test_get_default_device(scope.clone()) {
            let ranges = test_get_available_samplerate_of_device(device);
            for range in ranges {
                // Surprisingly, we can get the input/output sample rates from a non-input/non-output device.
                check_samplerates(range);
            }
        } else {
            println!("No device for {:?}.", scope);
        }
    }

    fn test_get_available_samplerate_of_device(id: AudioObjectID) -> Vec<(f64, f64)> {
        let scopes = [
            DeviceType::INPUT,
            DeviceType::OUTPUT,
            DeviceType::INPUT | DeviceType::OUTPUT,
        ];
        let mut ranges = Vec::new();
        for scope in scopes.iter() {
            ranges.push(
                run_serially_forward_panics(|| get_range_of_sample_rates(id, *scope)).unwrap(),
            );
        }
        ranges
    }

    fn check_samplerates((min, max): (f64, f64)) {
        assert!(min > 0.0);
        assert!(max > 0.0);
        assert!(min <= max);
    }
}

// get_presentation_latency
// ------------------------------------
#[test]
fn test_get_device_presentation_latency() {
    test_get_device_presentation_latencies_in_scope(Scope::Input);
    test_get_device_presentation_latencies_in_scope(Scope::Output);

    fn test_get_device_presentation_latencies_in_scope(scope: Scope) {
        if let Some(device) = test_get_default_device(scope.clone()) {
            // TODO: The latencies very from devices to devices. Check nothing here.
            let latency = run_serially(|| get_fixed_latency(device, scope.clone().into()));
            println!(
                "present latency on the device {} in scope {:?}: {}",
                device, scope, latency
            );
        } else {
            println!("No device for {:?}.", scope);
        }
    }
}

// get_device_group_id
// ------------------------------------
#[test]
fn test_get_device_group_id() {
    if let Some(device) = test_get_default_device(Scope::Input) {
        match run_serially(|| get_device_group_id(device, DeviceType::INPUT)) {
            Ok(id) => println!("input group id: {:?}", id),
            Err(e) => println!("No input group id. Error: {}", e),
        }
    } else {
        println!("No input device.");
    }

    if let Some(device) = test_get_default_device(Scope::Output) {
        match run_serially(|| get_device_group_id(device, DeviceType::OUTPUT)) {
            Ok(id) => println!("output group id: {:?}", id),
            Err(e) => println!("No output group id. Error: {}", e),
        }
    } else {
        println!("No output device.");
    }
}

#[test]
fn test_get_same_group_id_for_builtin_device_pairs() {
    use std::collections::HashMap;

    // These device sources have custom group id. See `get_custom_group_id`.
    const IMIC: u32 = 0x696D_6963; // "imic"
    const ISPK: u32 = 0x6973_706B; // "ispk"
    const EMIC: u32 = 0x656D_6963; // "emic"
    const HDPN: u32 = 0x6864_706E; // "hdpn"
    let pairs = [(IMIC, ISPK), (EMIC, HDPN)];

    let mut input_group_ids = HashMap::<u32, String>::new();
    let input_devices = test_get_devices_in_scope(Scope::Input);
    for device in input_devices.iter() {
        match run_serially(|| get_device_source(*device, DeviceType::INPUT)) {
            Ok(source) => match run_serially(|| get_device_group_id(*device, DeviceType::INPUT)) {
                Ok(id) => assert!(input_group_ids
                    .insert(source, id.into_string().unwrap())
                    .is_none()),
                Err(e) => assert!(input_group_ids
                    .insert(source, format!("Error {}", e))
                    .is_none()),
            },
            _ => {} // do nothing when failing to get source.
        }
    }

    let mut output_group_ids = HashMap::<u32, String>::new();
    let output_devices = test_get_devices_in_scope(Scope::Output);
    for device in output_devices.iter() {
        match run_serially(|| get_device_source(*device, DeviceType::OUTPUT)) {
            Ok(source) => match run_serially(|| get_device_group_id(*device, DeviceType::OUTPUT)) {
                Ok(id) => assert!(output_group_ids
                    .insert(source, id.into_string().unwrap())
                    .is_none()),
                Err(e) => assert!(output_group_ids
                    .insert(source, format!("Error {}", e))
                    .is_none()),
            },
            _ => {} // do nothing when failing to get source.
        }
    }

    for (input, output) in pairs.iter() {
        let input_group_id = input_group_ids.get(input);
        let output_group_id = output_group_ids.get(output);

        if input_group_id.is_some() && output_group_id.is_some() {
            assert_eq!(input_group_id, output_group_id);
        }

        input_group_ids.remove(input);
        output_group_ids.remove(output);
    }
}

#[test]
#[should_panic]
fn test_get_device_group_id_by_unknown_device() {
    assert!(run_serially_forward_panics(|| get_device_group_id(
        kAudioObjectUnknown,
        DeviceType::INPUT
    ))
    .is_err());
}

// get_device_label
// ------------------------------------
#[test]
fn test_get_device_label() {
    if let Some(device) = test_get_default_device(Scope::Input) {
        let name = run_serially(|| get_device_label(device, DeviceType::INPUT)).unwrap();
        println!("input device label: {}", name.into_string());
    } else {
        println!("No input device.");
    }

    if let Some(device) = test_get_default_device(Scope::Output) {
        let name = run_serially(|| get_device_label(device, DeviceType::OUTPUT)).unwrap();
        println!("output device label: {}", name.into_string());
    } else {
        println!("No output device.");
    }
}

#[test]
#[should_panic]
fn test_get_device_label_by_unknown_device() {
    assert!(run_serially_forward_panics(|| get_device_label(
        kAudioObjectUnknown,
        DeviceType::INPUT
    ))
    .is_err());
}

// get_device_global_uid
// ------------------------------------
#[test]
fn test_get_device_global_uid() {
    // Input device.
    if let Some(input) = test_get_default_device(Scope::Input) {
        let uid = run_serially(|| get_device_global_uid(input)).unwrap();
        let uid = uid.into_string();
        assert!(!uid.is_empty());
    }

    // Output device.
    if let Some(output) = test_get_default_device(Scope::Output) {
        let uid = run_serially(|| get_device_global_uid(output)).unwrap();
        let uid = uid.into_string();
        assert!(!uid.is_empty());
    }
}

#[test]
#[should_panic]
fn test_get_device_global_uid_by_unknwon_device() {
    // Unknown device.
    assert!(get_device_global_uid(kAudioObjectUnknown).is_err());
}

// create_cubeb_device_info
// destroy_cubeb_device_info
// ------------------------------------
#[test]
fn test_create_cubeb_device_info() {
    use std::collections::VecDeque;

    test_create_device_from_hwdev_in_scope(Scope::Input);
    test_create_device_from_hwdev_in_scope(Scope::Output);

    fn test_create_device_from_hwdev_in_scope(scope: Scope) {
        if let Some(device) = test_get_default_device(scope.clone()) {
            let is_input = test_device_in_scope(device, Scope::Input);
            let is_output = test_device_in_scope(device, Scope::Output);
            let mut results = test_create_device_infos_by_device(device);
            assert_eq!(results.len(), 2);
            // Input device type:
            let input_result = results.pop_front().unwrap();
            if is_input {
                let mut input_device_info = input_result.unwrap();
                check_device_info_by_device(&input_device_info, device, Scope::Input);
                run_serially(|| destroy_cubeb_device_info(&mut input_device_info));
            } else {
                assert_eq!(input_result.unwrap_err(), Error::error());
            }
            // Output device type:
            let output_result = results.pop_front().unwrap();
            if is_output {
                let mut output_device_info = output_result.unwrap();
                check_device_info_by_device(&output_device_info, device, Scope::Output);
                run_serially(|| destroy_cubeb_device_info(&mut output_device_info));
            } else {
                assert_eq!(output_result.unwrap_err(), Error::error());
            }
        } else {
            println!("No device for {:?}.", scope);
        }
    }

    fn test_create_device_infos_by_device(
        id: AudioObjectID,
    ) -> VecDeque<std::result::Result<ffi::cubeb_device_info, Error>> {
        let dev_types = [DeviceType::INPUT, DeviceType::OUTPUT];
        let mut results = VecDeque::new();
        for dev_type in dev_types.iter() {
            results.push_back(run_serially(|| create_cubeb_device_info(id, *dev_type)));
        }
        results
    }

    fn check_device_info_by_device(info: &ffi::cubeb_device_info, id: AudioObjectID, scope: Scope) {
        assert!(!info.devid.is_null());
        assert!(mem::size_of_val(&info.devid) >= mem::size_of::<AudioObjectID>());
        assert_eq!(info.devid as AudioObjectID, id);
        assert!(!info.device_id.is_null());
        assert!(!info.friendly_name.is_null());
        assert!(!info.group_id.is_null());

        // TODO: Hit a kAudioHardwareUnknownPropertyError for AirPods
        // assert!(!info.vendor_name.is_null());

        // FIXME: The device is defined to input-only or output-only, but some device is in-out!
        assert_eq!(info.device_type, DeviceType::from(scope.clone()).bits());
        assert_eq!(info.state, ffi::CUBEB_DEVICE_STATE_ENABLED);
        // TODO: The preference is set when the device is default input/output device if the device
        //       info is created from input/output scope. Should the preference be set if the
        //       device is a default input/output device if the device info is created from
        //       output/input scope ? The device may be a in-out device!
        assert_eq!(info.preferred, get_cubeb_device_pref(id, scope));

        assert_eq!(info.format, ffi::CUBEB_DEVICE_FMT_ALL);
        assert_eq!(info.default_format, ffi::CUBEB_DEVICE_FMT_F32NE);
        assert!(info.max_channels > 0);
        assert!(info.min_rate <= info.max_rate);
        assert!(info.min_rate <= info.default_rate);
        assert!(info.default_rate <= info.max_rate);

        assert!(info.latency_lo > 0);
        assert!(info.latency_hi > 0);
        assert!(info.latency_lo <= info.latency_hi);

        fn get_cubeb_device_pref(id: AudioObjectID, scope: Scope) -> ffi::cubeb_device_pref {
            let default_device = test_get_default_device(scope);
            if default_device.is_some() && default_device.unwrap() == id {
                ffi::CUBEB_DEVICE_PREF_ALL
            } else {
                ffi::CUBEB_DEVICE_PREF_NONE
            }
        }
    }
}

#[test]
#[should_panic]
fn test_create_device_info_by_unknown_device() {
    assert!(create_cubeb_device_info(kAudioObjectUnknown, DeviceType::OUTPUT).is_err());
}

#[test]
fn test_create_device_info_with_unknown_type() {
    test_create_device_info_with_unknown_type_by_scope(Scope::Input);
    test_create_device_info_with_unknown_type_by_scope(Scope::Output);

    fn test_create_device_info_with_unknown_type_by_scope(scope: Scope) {
        if let Some(device) = test_get_default_device(scope.clone()) {
            assert!(
                run_serially(|| create_cubeb_device_info(device, DeviceType::UNKNOWN)).is_err()
            );
        }
    }
}

#[test]
#[should_panic]
fn test_device_destroy_empty_device() {
    let mut device = ffi::cubeb_device_info::default();

    assert!(device.device_id.is_null());
    assert!(device.group_id.is_null());
    assert!(device.friendly_name.is_null());
    assert!(device.vendor_name.is_null());

    // `friendly_name` must be set.
    destroy_cubeb_device_info(&mut device);

    assert!(device.device_id.is_null());
    assert!(device.group_id.is_null());
    assert!(device.friendly_name.is_null());
    assert!(device.vendor_name.is_null());
}

#[test]
fn test_create_device_from_hwdev_with_inout_type() {
    test_create_device_from_hwdev_with_inout_type_by_scope(Scope::Input);
    test_create_device_from_hwdev_with_inout_type_by_scope(Scope::Output);

    fn test_create_device_from_hwdev_with_inout_type_by_scope(scope: Scope) {
        if let Some(device) = test_get_default_device(scope.clone()) {
            // Get a kAudioHardwareUnknownPropertyError in get_channel_count actually.
            assert!(run_serially(|| create_cubeb_device_info(
                device,
                DeviceType::INPUT | DeviceType::OUTPUT
            ))
            .is_err());
        } else {
            println!("No device for {:?}.", scope);
        }
    }
}

// get_devices_of_type
// ------------------------------------
#[test]
fn test_get_devices_of_type() {
    use std::collections::HashSet;

    let all_devices =
        run_serially(|| audiounit_get_devices_of_type(DeviceType::INPUT | DeviceType::OUTPUT));
    let input_devices = run_serially(|| audiounit_get_devices_of_type(DeviceType::INPUT));
    let output_devices = run_serially(|| audiounit_get_devices_of_type(DeviceType::OUTPUT));

    let mut expected_all = test_get_all_devices(DeviceFilter::ExcludeCubebAggregateAndVPIO);
    expected_all.sort();
    assert_eq!(all_devices, expected_all);
    for device in all_devices.iter() {
        if test_device_in_scope(*device, Scope::Input) {
            assert!(input_devices.contains(device));
        }
        if test_device_in_scope(*device, Scope::Output) {
            assert!(output_devices.contains(device));
        }
    }

    let input: HashSet<AudioObjectID> = input_devices.iter().cloned().collect();
    let output: HashSet<AudioObjectID> = output_devices.iter().cloned().collect();
    let union: HashSet<AudioObjectID> = input.union(&output).cloned().collect();
    let mut union_devices: Vec<AudioObjectID> = union.iter().cloned().collect();
    union_devices.sort();
    assert_eq!(all_devices, union_devices);
}

#[test]
#[should_panic]
fn test_get_devices_of_type_unknown() {
    run_serially_forward_panics(|| {
        let no_devs = audiounit_get_devices_of_type(DeviceType::UNKNOWN);
        assert!(no_devs.is_empty());
    });
}

// add_devices_changed_listener
// ------------------------------------
#[test]
fn test_add_devices_changed_listener() {
    use std::collections::HashMap;

    extern "C" fn inout_callback(_: *mut ffi::cubeb, _: *mut c_void) {}
    extern "C" fn in_callback(_: *mut ffi::cubeb, _: *mut c_void) {}
    extern "C" fn out_callback(_: *mut ffi::cubeb, _: *mut c_void) {}

    let mut map: HashMap<DeviceType, extern "C" fn(*mut ffi::cubeb, *mut c_void)> = HashMap::new();
    map.insert(DeviceType::INPUT, in_callback);
    map.insert(DeviceType::OUTPUT, out_callback);
    map.insert(DeviceType::INPUT | DeviceType::OUTPUT, inout_callback);

    test_get_raw_context(|context| {
        for (devtype, callback) in map.iter() {
            assert!(get_devices_changed_callback(context, Scope::Input).is_none());
            assert!(get_devices_changed_callback(context, Scope::Output).is_none());

            // Register a callback within a specific scope.
            assert!(run_serially(|| {
                context.add_devices_changed_listener(*devtype, Some(*callback), ptr::null_mut())
            })
            .is_ok());

            if devtype.contains(DeviceType::INPUT) {
                let cb = get_devices_changed_callback(context, Scope::Input);
                assert!(cb.is_some());
                assert_eq!(cb.unwrap(), *callback);
            } else {
                let cb = get_devices_changed_callback(context, Scope::Input);
                assert!(cb.is_none());
            }

            if devtype.contains(DeviceType::OUTPUT) {
                let cb = get_devices_changed_callback(context, Scope::Output);
                assert!(cb.is_some());
                assert_eq!(cb.unwrap(), *callback);
            } else {
                let cb = get_devices_changed_callback(context, Scope::Output);
                assert!(cb.is_none());
            }

            // Unregister the callbacks within all scopes.
            assert!(run_serially(|| {
                context.remove_devices_changed_listener(DeviceType::INPUT | DeviceType::OUTPUT)
            })
            .is_ok());

            assert!(get_devices_changed_callback(context, Scope::Input).is_none());
            assert!(get_devices_changed_callback(context, Scope::Output).is_none());
        }
    });
}

#[test]
#[should_panic]
fn test_add_devices_changed_listener_in_unknown_scope() {
    extern "C" fn callback(_: *mut ffi::cubeb, _: *mut c_void) {}

    test_get_raw_context(|context| {
        let _ = context.add_devices_changed_listener(
            DeviceType::UNKNOWN,
            Some(callback),
            ptr::null_mut(),
        );
    });
}

#[test]
#[should_panic]
fn test_add_devices_changed_listener_with_none_callback() {
    test_get_raw_context(|context| {
        for devtype in &[DeviceType::INPUT, DeviceType::OUTPUT] {
            assert!(context
                .add_devices_changed_listener(*devtype, None, ptr::null_mut())
                .is_ok());
        }
    });
}

// remove_devices_changed_listener
// ------------------------------------
#[test]
fn test_remove_devices_changed_listener() {
    use std::collections::HashMap;

    extern "C" fn in_callback(_: *mut ffi::cubeb, _: *mut c_void) {}
    extern "C" fn out_callback(_: *mut ffi::cubeb, _: *mut c_void) {}

    let mut map: HashMap<DeviceType, extern "C" fn(*mut ffi::cubeb, *mut c_void)> = HashMap::new();
    map.insert(DeviceType::INPUT, in_callback);
    map.insert(DeviceType::OUTPUT, out_callback);

    test_get_raw_context(|context| {
        for (devtype, _callback) in map.iter() {
            assert!(get_devices_changed_callback(context, Scope::Input).is_none());
            assert!(get_devices_changed_callback(context, Scope::Output).is_none());

            // Register callbacks within all scopes.
            for (scope, listener) in map.iter() {
                assert!(run_serially(|| context.add_devices_changed_listener(
                    *scope,
                    Some(*listener),
                    ptr::null_mut()
                ))
                .is_ok());
            }

            let input_callback = get_devices_changed_callback(context, Scope::Input);
            assert!(input_callback.is_some());
            assert_eq!(
                input_callback.unwrap(),
                *(map.get(&DeviceType::INPUT).unwrap())
            );
            let output_callback = get_devices_changed_callback(context, Scope::Output);
            assert!(output_callback.is_some());
            assert_eq!(
                output_callback.unwrap(),
                *(map.get(&DeviceType::OUTPUT).unwrap())
            );

            // Unregister the callbacks within one specific scopes.
            assert!(run_serially(|| context.remove_devices_changed_listener(*devtype)).is_ok());

            if devtype.contains(DeviceType::INPUT) {
                let cb = get_devices_changed_callback(context, Scope::Input);
                assert!(cb.is_none());
            } else {
                let cb = get_devices_changed_callback(context, Scope::Input);
                assert!(cb.is_some());
                assert_eq!(cb.unwrap(), *(map.get(&DeviceType::INPUT).unwrap()));
            }

            if devtype.contains(DeviceType::OUTPUT) {
                let cb = get_devices_changed_callback(context, Scope::Output);
                assert!(cb.is_none());
            } else {
                let cb = get_devices_changed_callback(context, Scope::Output);
                assert!(cb.is_some());
                assert_eq!(cb.unwrap(), *(map.get(&DeviceType::OUTPUT).unwrap()));
            }

            // Unregister the callbacks within all scopes.
            assert!(run_serially(
                || context.remove_devices_changed_listener(DeviceType::INPUT | DeviceType::OUTPUT)
            )
            .is_ok());
        }
    });
}

#[test]
fn test_remove_devices_changed_listener_without_adding_listeners() {
    test_get_raw_context(|context| {
        for devtype in &[
            DeviceType::INPUT,
            DeviceType::OUTPUT,
            DeviceType::INPUT | DeviceType::OUTPUT,
        ] {
            assert!(run_serially(|| context.remove_devices_changed_listener(*devtype)).is_ok());
        }
    });
}

#[test]
fn test_remove_devices_changed_listener_within_all_scopes() {
    use std::collections::HashMap;

    extern "C" fn inout_callback(_: *mut ffi::cubeb, _: *mut c_void) {}
    extern "C" fn in_callback(_: *mut ffi::cubeb, _: *mut c_void) {}
    extern "C" fn out_callback(_: *mut ffi::cubeb, _: *mut c_void) {}

    let mut map: HashMap<DeviceType, extern "C" fn(*mut ffi::cubeb, *mut c_void)> = HashMap::new();
    map.insert(DeviceType::INPUT, in_callback);
    map.insert(DeviceType::OUTPUT, out_callback);
    map.insert(DeviceType::INPUT | DeviceType::OUTPUT, inout_callback);

    test_get_raw_context(|context| {
        for (devtype, callback) in map.iter() {
            assert!(get_devices_changed_callback(context, Scope::Input).is_none());
            assert!(get_devices_changed_callback(context, Scope::Output).is_none());

            assert!(run_serially(|| context.add_devices_changed_listener(
                *devtype,
                Some(*callback),
                ptr::null_mut()
            ))
            .is_ok());

            if devtype.contains(DeviceType::INPUT) {
                let cb = get_devices_changed_callback(context, Scope::Input);
                assert!(cb.is_some());
                assert_eq!(cb.unwrap(), *callback);
            }

            if devtype.contains(DeviceType::OUTPUT) {
                let cb = get_devices_changed_callback(context, Scope::Output);
                assert!(cb.is_some());
                assert_eq!(cb.unwrap(), *callback);
            }

            assert!(run_serially(
                || context.remove_devices_changed_listener(DeviceType::INPUT | DeviceType::OUTPUT)
            )
            .is_ok());

            assert!(get_devices_changed_callback(context, Scope::Input).is_none());
            assert!(get_devices_changed_callback(context, Scope::Output).is_none());
        }
    });
}

fn get_devices_changed_callback(
    context: &AudioUnitContext,
    scope: Scope,
) -> ffi::cubeb_device_collection_changed_callback {
    let devices_guard = context.devices.lock().unwrap();
    match scope {
        Scope::Input => devices_guard.input.changed_callback,
        Scope::Output => devices_guard.output.changed_callback,
    }
}

// SharedVoiceProcessingUnitManager
// ------------------------------------
#[test]
fn test_shared_voice_processing_unit() {
    let queue = Queue::new_with_target(
        "test_shared_voice_processing_unit",
        get_serial_queue_singleton(),
    );
    let mut shared = SharedVoiceProcessingUnitManager::new(queue.clone());
    let r1 = queue.run_sync(|| shared.take()).unwrap();
    assert!(r1.is_err());
    let r2 = queue.run_sync(|| shared.take_or_create()).unwrap();
    assert!(r2.is_ok());
    {
        let _handle = r2.unwrap();
        let r3 = queue.run_sync(|| shared.take()).unwrap();
        assert!(r3.is_err());
    }
    let r4 = queue.run_sync(|| shared.take()).unwrap();
    assert!(r4.is_ok());
}

#[test]
#[should_panic]
fn test_shared_voice_processing_unit_bad_release_order() {
    let queue = Queue::new_with_target(
        "test_shared_voice_processing_unit_bad_release_order",
        get_serial_queue_singleton(),
    );
    let mut shared = SharedVoiceProcessingUnitManager::new(queue.clone());
    let r1 = queue.run_sync(|| shared.take()).unwrap();
    assert!(r1.is_ok());
    drop(shared);
    run_serially_forward_panics(|| drop(r1));
}

#[test]
fn test_shared_voice_processing_multiple_units() {
    let queue = Queue::new_with_target(
        "test_shared_voice_processing_multiple_units",
        get_serial_queue_singleton(),
    );
    let mut shared = SharedVoiceProcessingUnitManager::new(queue.clone());
    let r1 = queue.run_sync(|| shared.take_or_create()).unwrap();
    assert!(r1.is_ok());
    let r2 = queue.run_sync(|| shared.take_or_create()).unwrap();
    assert!(r2.is_ok());
    {
        let _handle1 = r1.unwrap();
        let _handle2 = r2.unwrap();
        let r3 = queue.run_sync(|| shared.take()).unwrap();
        assert!(r3.is_err());
    }
    let r1 = queue.run_sync(|| shared.take()).unwrap();
    assert!(r1.is_ok());
    let r2 = queue.run_sync(|| shared.take()).unwrap();
    assert!(r2.is_ok());
    let r3 = queue.run_sync(|| shared.take()).unwrap();
    assert!(r3.is_err());
}

#[test]
fn test_shared_voice_processing_release_on_idle() {
    let queue = Queue::new_with_target(
        "test_shared_voice_processing_release_on_idle",
        get_serial_queue_singleton(),
    );
    let mut shared = SharedVoiceProcessingUnitManager::with_idle_timeout(
        queue.clone(),
        Duration::from_millis(0),
    );
    let r = queue.run_sync(|| shared.take_or_create()).unwrap();
    assert!(r.is_ok());
    {
        let _handle = r.unwrap();
    }
    queue.run_sync(|| {});
    let r = queue.run_sync(|| shared.take()).unwrap();
    assert!(r.is_err());
}

#[test]
fn test_shared_voice_processing_no_release_on_outstanding() {
    let queue = Queue::new_with_target(
        "test_shared_voice_processing_no_release_on_outstanding",
        get_serial_queue_singleton(),
    );
    let mut shared = SharedVoiceProcessingUnitManager::with_idle_timeout(
        queue.clone(),
        Duration::from_millis(0),
    );
    let r1 = queue.run_sync(|| shared.take_or_create()).unwrap();
    assert!(r1.is_ok());
    let r2 = queue.run_sync(|| shared.take_or_create()).unwrap();
    assert!(r2.is_ok());
    {
        let _handle1 = r1.unwrap();
    }
    queue.run_sync(|| {});
    let r1 = queue.run_sync(|| shared.take()).unwrap();
    assert!(r1.is_ok());
}

#[test]
fn test_shared_voice_processing_release_on_idle_cancel_on_take() {
    let queue = Queue::new_with_target(
        "test_shared_voice_processing_release_on_idle_cancel_on_take",
        get_serial_queue_singleton(),
    );
    let mut shared = SharedVoiceProcessingUnitManager::with_idle_timeout(
        queue.clone(),
        Duration::from_millis(0),
    );
    let r1 = queue.run_sync(|| shared.take_or_create()).unwrap();
    assert!(r1.is_ok());
    let r2 = queue.run_sync(|| shared.take_or_create()).unwrap();
    assert!(r2.is_ok());
    let r1 = queue
        .run_sync(|| {
            {
                let _handle1 = r1.unwrap();
                let _handle2 = r2.unwrap();
            }
            shared.take()
        })
        .unwrap();
    assert!(r1.is_ok());
    queue.run_sync(|| {});
    let r2 = queue.run_sync(|| shared.take()).unwrap();
    assert!(r2.is_ok());
}
