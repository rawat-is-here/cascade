import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  shopName: string;
  vendorName?: string;
  vendorPhone?: string;
  serverUrl?: string;
  currentLanguage?: 'en' | 'hi';
  onLanguageChange?: (lang: 'en' | 'hi') => void;
  onSaveProfile: (profile: { shopName: string; vendorName: string; phone: string; language: 'en' | 'hi'; serverUrl?: string }) => void;
}

export const SettingsModal: React.FC<Props> = ({
  visible,
  onClose,
  shopName: initialShopName,
  vendorName: initialVendorName = 'Akash Rawat',
  vendorPhone: initialPhone = '+91 98765 43210',
  serverUrl: initialServerUrl = 'https://tame-shoes-change.loca.lt/api',
  currentLanguage: initialLang = 'en',
  onLanguageChange,
  onSaveProfile
}) => {
  const [currentPage, setCurrentPage] = useState<'SETTINGS' | 'EDIT_PROFILE'>('SETTINGS');
  const [shopName, setShopName] = useState(initialShopName);
  const [vendorName, setVendorName] = useState(initialVendorName);
  const [phone, setPhone] = useState(initialPhone);
  const [serverUrl, setServerUrl] = useState(initialServerUrl);
  const [language, setLanguage] = useState<'en' | 'hi'>(initialLang);

  useEffect(() => {
    if (initialLang) {
      setLanguage(initialLang);
    }
  }, [initialLang, visible]);

  const handleSave = () => {
    onSaveProfile({
      shopName: shopName.trim() || initialShopName,
      vendorName: vendorName.trim() || initialVendorName,
      phone: phone.trim() || initialPhone,
      serverUrl: serverUrl.trim() || initialServerUrl,
      language
    });
    setCurrentPage('SETTINGS');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              {currentPage === 'EDIT_PROFILE' ? (
                <TouchableOpacity onPress={() => setCurrentPage('SETTINGS')} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={20} color="#073B3A" />
                </TouchableOpacity>
              ) : (
                <View style={styles.iconBox}>
                  <Ionicons name="settings-outline" size={20} color="#073B3A" />
                </View>
              )}
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.modalTitle}>
                  {currentPage === 'EDIT_PROFILE'
                    ? (language === 'hi' ? 'दुकानदार विवरण बदलें' : 'Edit Vendor Details')
                    : (language === 'hi' ? 'सेटिंग्स' : 'Settings')}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {currentPage === 'EDIT_PROFILE'
                    ? (language === 'hi' ? 'नाम, मोबाइल और दुकान की जानकारी' : 'Change name, mobile and stall details')
                    : (language === 'hi' ? 'भाषा और प्रोफाइल प्रबंधन' : 'Language and profile management')}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Page Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, currentPage === 'SETTINGS' && styles.tabItemActive]}
              onPress={() => setCurrentPage('SETTINGS')}
            >
              <Text style={[styles.tabText, currentPage === 'SETTINGS' && styles.tabTextActive]}>
                {language === 'hi' ? 'सामान्य' : 'General'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabItem, currentPage === 'EDIT_PROFILE' && styles.tabItemActive]}
              onPress={() => setCurrentPage('EDIT_PROFILE')}
            >
              <Text style={[styles.tabText, currentPage === 'EDIT_PROFILE' && styles.tabTextActive]}>
                {language === 'hi' ? 'प्रोफाइल बदलें' : 'Edit Profile'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {currentPage === 'SETTINGS' ? (
              <>
                {/* Language Selector */}
                <Text style={styles.sectionLabel}>
                  {language === 'hi' ? 'भाषा (Language)' : 'Language'}
                </Text>
                <View style={styles.langRow}>
                  <TouchableOpacity
                    style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
                    onPress={() => {
                      setLanguage('en');
                      onLanguageChange?.('en');
                    }}
                  >
                    <Ionicons
                      name={language === 'en' ? 'radio-button-on' : 'radio-button-off'}
                      size={16}
                      color={language === 'en' ? '#073B3A' : '#9CA3AF'}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>English</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.langBtn, language === 'hi' && styles.langBtnActive]}
                    onPress={() => {
                      setLanguage('hi');
                      onLanguageChange?.('hi');
                    }}
                  >
                    <Ionicons
                      name={language === 'hi' ? 'radio-button-on' : 'radio-button-off'}
                      size={16}
                      color={language === 'hi' ? '#073B3A' : '#9CA3AF'}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.langText, language === 'hi' && styles.langTextActive]}>हिन्दी (Hindi)</Text>
                  </TouchableOpacity>
                </View>

                {/* Profile Summary Card */}
                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
                  {language === 'hi' ? 'दुकानदार प्रोफाइल' : 'Vendor Profile'}
                </Text>

                <View style={styles.profileSummaryCard}>
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>
                      {(vendorName || 'A').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.profileVendorName}>{vendorName || 'Akash Rawat'}</Text>
                    <Text style={styles.profileShopName}>{shopName}</Text>
                    <Text style={styles.profilePhone}>{phone}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editProfileBtn}
                    onPress={() => setCurrentPage('EDIT_PROFILE')}
                  >
                    <Ionicons name="create-outline" size={16} color="#073B3A" />
                    <Text style={styles.editProfileBtnText}>
                      {language === 'hi' ? 'बदलें' : 'Edit'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Local Security Info */}
                <View style={styles.infoBox}>
                  <Ionicons name="shield-checkmark" size={16} color="#073B3A" style={{ marginRight: 8 }} />
                  <Text style={styles.infoText}>
                    {language === 'hi'
                      ? 'सभी विवरण स्थानीय SQLite में सुरक्षित हैं।'
                      : 'All details stored locally in offline SQLite. Zero telemetry.'}
                  </Text>
                </View>

                {/* Apply Language & Close */}
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#073B3A" style={{ marginRight: 8 }} />
                  <Text style={styles.saveBtnText}>
                    {language === 'hi' ? 'सेव करें' : 'Done'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Dedicated Profile Edit Page */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>
                    {language === 'hi' ? 'दुकान का नाम' : 'Stall / Shop Name'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={shopName}
                    onChangeText={setShopName}
                    placeholder="e.g. Akash Fruits & Veggies"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>
                    {language === 'hi' ? 'दुकानदार का नाम' : 'Vendor Full Name'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={vendorName}
                    onChangeText={setVendorName}
                    placeholder="e.g. Akash Rawat"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>
                    {language === 'hi' ? 'मोबाइल नंबर' : 'Mobile Number'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+91 98765 43210"
                    keyboardType="phone-pad"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>
                    {language === 'hi' ? 'सर्वर कनेक्शन URL' : 'Backend Server URL'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={serverUrl}
                    onChangeText={setServerUrl}
                    placeholder="https://tame-shoes-change.loca.lt/api"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                  />
                </View>

                {/* Action Buttons */}
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Ionicons name="save-outline" size={18} color="#073B3A" style={{ marginRight: 8 }} />
                  <Text style={styles.saveBtnText}>
                    {language === 'hi' ? 'प्रोफाइल सेव करें' : 'Save Profile Changes'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelLinkBtn}
                  onPress={() => setCurrentPage('SETTINGS')}
                >
                  <Text style={styles.cancelLinkText}>
                    {language === 'hi' ? 'रद्द करें' : 'Back to Settings'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 59, 58, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#E2FD52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#073B3A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 20,
    backgroundColor: '#FAFAFA',
  },
  tabItem: {
    paddingVertical: 12,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#073B3A',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#073B3A',
    fontWeight: '800',
  },
  scrollBody: {
    padding: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#073B3A',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  langRow: {
    flexDirection: 'row',
    gap: 12,
  },
  langBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    borderRadius: 16,
  },
  langBtnActive: {
    backgroundColor: '#F1FFE5',
    borderColor: '#79AF00',
  },
  langText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B7280',
  },
  langTextActive: {
    color: '#073B3A',
    fontWeight: '800',
  },
  profileSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FCF9',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DDECE7',
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#073B3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#E2FD52',
  },
  profileVendorName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#073B3A',
  },
  profileShopName: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
    marginTop: 1,
  },
  profilePhone: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  editProfileBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#073B3A',
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#111827',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FCF9',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DDECE7',
    marginVertical: 14,
  },
  infoText: {
    fontSize: 13,
    color: '#073B3A',
    fontWeight: '600',
    flex: 1,
  },
  tutorialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 4,
    marginBottom: 8,
  },
  tutorialBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#073B3A',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2FD52',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 6,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#073B3A',
  },
  cancelLinkBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
});
