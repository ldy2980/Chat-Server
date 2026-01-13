import React, { useState, useEffect, useCallback } from 'react';
import { User, ChatRoom, CreateChatRoomRequest } from '../types/index';
import { chatRoomApi } from '../services/api.ts';
import { theme } from '../styles/theme.ts';
import Button from './ui/Button.tsx';
import Input from './ui/Input.tsx';
import { 
  Plus, 
  Search, 
  Users, 
  Hash, 
  MessageCircle, 
  Settings,
  X,
  ChevronRight,
  UserCheck
} from 'lucide-react';

interface ChatRoomListProps {
  currentUser: User;
  selectedChatRoom?: ChatRoom;
  onChatRoomSelect: (chatRoom: ChatRoom) => void;
  onError: (error: string) => void;
}

const ChatRoomList: React.FC<ChatRoomListProps> = ({
  currentUser,
  selectedChatRoom,
  onChatRoomSelect,
  onError,
}) => {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newRoomData, setNewRoomData] = useState<CreateChatRoomRequest>({
    name: '',
    description: '',
    type: 'GROUP',
    maxMembers: 3,
  });
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const loadChatRooms = useCallback(async () => {
    try {
      setLoading(true);
      const response = await chatRoomApi.getChatRooms(currentUser.id);
      setChatRooms(response.content);
    } catch (error: any) {
      console.error('Failed to load chat rooms:', error);
      onError('채팅방 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, [currentUser.id, onError]);



  // 채팅방 참여
  const handleJoinRoom = async () => {
    if (!joinRoomId.trim()) {
      onError('채팅방 ID를 입력해주세요');
      return;
    }

    try {
      setJoinLoading(true);
      const roomId = parseInt(joinRoomId);
      if (isNaN(roomId)) {
        onError('올바른 채팅방 ID를 입력해주세요');
        return;
      }

      await chatRoomApi.join(roomId, currentUser.id);
      await loadChatRooms(); // 채팅방 목록 새로고침
      setShowJoinModal(false);
      setJoinRoomId('');
      
      // 참여한 채팅방 선택
      const joinedRoom = await chatRoomApi.getChatRoom(roomId);
      onChatRoomSelect(joinedRoom);
    } catch (error: any) {
      console.error('Failed to join chat room:', error);
      if (error.response?.status === 404) {
        onError('채팅방을 찾을 수 없습니다');
      } else if (error.response?.status === 409) {
        onError('이미 참여한 채팅방입니다');
      } else if (error.response?.status === 400) {
        onError('채팅방이 가득 찼습니다');
      } else {
        onError('채팅방 참여에 실패했습니다');
      }
    } finally {
      setJoinLoading(false);
    }
  };

  useEffect(() => {
    loadChatRooms();
  }, [loadChatRooms]);

  const handleCreateRoom = async () => {
    if (!newRoomData.name.trim()) {
      onError('채팅방 이름을 입력해주세요');
      return;
    }

    try {
      setCreateLoading(true);
      const newRoom = await chatRoomApi.create(newRoomData, currentUser.id);
      setChatRooms(prev => [newRoom, ...prev]);
      setShowCreateModal(false);
      setNewRoomData({
        name: '',
        description: '',
        type: 'GROUP',
        maxMembers: 3,
      });
      onChatRoomSelect(newRoom);
    } catch (error: any) {
      console.error('Failed to create chat room:', error);
      onError('채팅방 생성에 실패했습니다');
    } finally {
      setCreateLoading(false);
    }
  };

  const filteredChatRooms = chatRooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoomIcon = (type: string) => {
    switch (type) {
      case 'DIRECT':
        return <MessageCircle size={16} />;
      case 'CHANNEL':
        return <Hash size={16} />;
      default:
        return <Users size={16} />;
    }
  };

  const getLastMessageTime = (chatRoom: ChatRoom) => {
    if (!chatRoom.lastMessage?.createdAt) return '';
    
    try {
      const date = new Date(chatRoom.lastMessage.createdAt);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (minutes < 1) return '방금';
      if (minutes < 60) return `${minutes}분 전`;
      if (hours < 24) return `${hours}시간 전`;
      if (days < 7) return `${days}일 전`;
      return date.toLocaleDateString('ko-KR', { 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return '';
    }
  };

  const sidebarStyle: React.CSSProperties = {
    width: '320px',
    height: '100vh',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRight: `1px solid ${theme.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.white,
  };

  const userInfoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  };

  const avatarStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.white,
    fontWeight: theme.fontWeights.semibold,
    fontSize: theme.fontSizes.md,
  };

  const userNameStyle: React.CSSProperties = {
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.textPrimary,
    fontSize: theme.fontSizes.md,
  };

  const userStatusStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
  };

  const searchContainerStyle: React.CSSProperties = {
    padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.white,
  };

  const roomListStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing.xs,
  };

  const roomItemStyle = (isSelected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing.md,
    margin: `0 0 ${theme.spacing.xs}`,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    transition: theme.transitions.normal,
    backgroundColor: isSelected ? theme.colors.primaryLight : 'transparent',
    border: isSelected ? `1px solid ${theme.colors.primary}` : '1px solid transparent',
  });

  const roomIconStyle: React.CSSProperties = {
    width: '44px',
    height: '44px',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
    color: theme.colors.textSecondary,
  };

  const roomInfoStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const roomNameStyle: React.CSSProperties = {
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.textPrimary,
    fontSize: theme.fontSizes.md,
    marginBottom: theme.spacing.xs,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const roomLastMessageStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const roomMetaStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
  };

  const roomTimeStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textTertiary,
  };

  const roomMemberCountStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textTertiary,
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  };

  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: theme.zIndex.modal,
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '90%',
    maxWidth: '400px',
    maxHeight: '80vh',
    overflow: 'auto',
  };

  const modalHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  };

  const modalTitleStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xl,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.textPrimary,
  };

  const modalFormStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.primary,
    backgroundColor: theme.colors.white,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    outline: 'none',
    transition: theme.transitions.normal,
  };

  return (
    <div style={sidebarStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={userInfoStyle}>
          <div style={avatarStyle}>
            {currentUser.displayName.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={userNameStyle}>{currentUser.displayName}</div>
            <div style={userStatusStyle}>
              <UserCheck size={12} style={{ marginRight: '4px' }} />
              온라인
            </div>
          </div>
          <Button variant="ghost" size="sm">
            <Settings size={16} />
          </Button>
        </div>
      </div>

      {/* Search and Create */}
      <div style={searchContainerStyle}>
        <div style={{ display: 'flex', gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowCreateModal(true)}
            style={{ flex: 1 }}
          >
            <Plus size={16} />
            새 채팅방
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setShowJoinModal(true)}
            style={{ flex: 1 }}
          >
            <UserCheck size={16} />
            참여하기
          </Button>
        </div>
        
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{
            position: 'absolute',
            left: theme.spacing.md,
            top: '50%',
            transform: 'translateY(-50%)',
            color: theme.colors.textTertiary,
            zIndex: 1,
          }} />
          <Input
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="채팅방 검색..."
            style={{ paddingLeft: '40px' }}
          />
        </div>
      </div>

      {/* Room List */}
      <div style={roomListStyle}>
        {loading ? (
          <div style={{ 
            padding: theme.spacing.xl, 
            textAlign: 'center',
            color: theme.colors.textSecondary 
          }}>
            <div className="animate-pulse">채팅방을 불러오는 중...</div>
          </div>
        ) : filteredChatRooms.length === 0 ? (
          <div style={{ 
            padding: theme.spacing.xl, 
            textAlign: 'center',
            color: theme.colors.textSecondary 
          }}>
            {searchQuery ? '검색 결과가 없습니다' : '채팅방이 없습니다'}
          </div>
        ) : (
          filteredChatRooms.map((room) => (
            <div
              key={room.id}
              style={roomItemStyle(selectedChatRoom?.id === room.id)}
              onClick={() => onChatRoomSelect(room)}
              className="animate-fadeIn"
            >
              <div style={roomIconStyle}>
                {getRoomIcon(room.type)}
              </div>
              
              <div style={roomInfoStyle}>
                <div style={roomNameStyle}>{room.name}</div>
                <div style={roomLastMessageStyle}>
                  Welcome
                </div>
              </div>
              
              <div style={roomMetaStyle}>
                <div style={roomTimeStyle}>
                  {getLastMessageTime(room)}
                </div>
                <div style={roomMemberCountStyle}>
                  <Users size={10} />
                  {room.memberCount}
                </div>
              </div>
              
              <ChevronRight size={16} style={{ color: theme.colors.textTertiary }} />
            </div>
          ))
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div style={modalOverlayStyle} onClick={() => setShowCreateModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h3 style={modalTitleStyle}>새 채팅방 만들기</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={16} />
              </Button>
            </div>

            <div style={modalFormStyle}>
              <Input
                value={newRoomData.name}
                onChange={(value) => setNewRoomData(prev => ({ ...prev, name: value }))}
                placeholder="채팅방 이름"
                maxLength={100}
                autoFocus
              />


              <div style={{ 
                display: 'flex', 
                gap: theme.spacing.sm, 
                marginTop: theme.spacing.md 
              }}>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setShowCreateModal(false)}
                  style={{ flex: 1 }}
                >
                  취소
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  loading={createLoading}
                  onClick={handleCreateRoom}
                  style={{ flex: 1 }}
                >
                  생성
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Join Room Modal */}
      {showJoinModal && (
        <div style={modalOverlayStyle} onClick={() => setShowJoinModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h3 style={modalTitleStyle}>채팅방 참여하기</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowJoinModal(false)}
              >
                <X size={16} />
              </Button>
            </div>

            <div style={modalFormStyle}>
              <Input
                value={joinRoomId}
                onChange={setJoinRoomId}
                placeholder="채팅방 ID를 입력하세요"
                type="number"
                autoFocus
              />

              <div style={{ 
                fontSize: theme.fontSizes.sm, 
                color: theme.colors.textSecondary,
                padding: theme.spacing.sm,
                backgroundColor: theme.colors.gray100,
                borderRadius: theme.borderRadius.md,
                marginTop: theme.spacing.sm
              }}>
                💡 채팅방 ID는 채팅방 헤더에서 확인할 수 있습니다.
              </div>

              <div style={{ 
                display: 'flex', 
                gap: theme.spacing.sm, 
                marginTop: theme.spacing.md 
              }}>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setShowJoinModal(false)}
                  style={{ flex: 1 }}
                >
                  취소
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  loading={joinLoading}
                  onClick={handleJoinRoom}
                  style={{ flex: 1 }}
                >
                  참여
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatRoomList; 